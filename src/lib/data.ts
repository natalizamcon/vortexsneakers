// Carga los datos de Supabase y los convierte al formato que usan las pantallas.
// Las acciones llaman a las operaciones seguras de la base de datos.
import { supabase, fotoUrl, mensajeError, comprimirImagen, BUCKET, BUCKET_COMPROBANTES } from "./supabase";
import { prepararVideo, MAX_MB } from "../components/videos";
import { ROLES, colorHex, isoLocal, addDays, TODAY, bs, fdate } from "./utils";

const num = (v) => Number(v) || 0;

/** Lee una tabla completa (Supabase entrega de a 1000 filas) */
async function leerTodo(tabla: string, orden = "creado_en") {
  const filas = [];
  const paso = 1000;
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await supabase.from(tabla).select("*").order(orden, { ascending: true }).range(desde, desde + paso - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < paso) break;
  }
  return filas;
}

export const DB_VACIA = {
  users: [], providers: [], lots: [], products: [], clients: [], reservations: [], sales: [], payments: [], qrs: [], comprobantes: [],
  expenses: [], otherIncome: [], events: [], audit: [],
  config: { canales: [], metodos: [], destinos: [], vigenciaHoras: 48, diasBajaRotacion: 30, whatsapp: "", paqueteria: "", paqueterias: [] },
};

export async function cargarTodo(esAdmin: boolean) {
  const [perfiles, cfg, proveedores, lotes, productos, fotos, clientes, reservas, ventas, items, pagos, gastos, otros, eventos, auditoria, qrs, comprobantes, videos] = await Promise.all([
    leerTodo("perfiles"),
    supabase.from("configuracion").select("*").eq("id", 1).maybeSingle(),
    leerTodo("proveedores"),
    leerTodo("lotes", "id"),
    leerTodo("productos", "codigo"),
    leerTodo("producto_fotos", "orden"),
    leerTodo("clientes"),
    leerTodo("reservas"),
    leerTodo("ventas"),
    leerTodo("venta_items", "id"),
    leerTodo("pagos"),
    esAdmin ? leerTodo("gastos") : Promise.resolve([]),
    esAdmin ? leerTodo("otros_ingresos") : Promise.resolve([]),
    leerTodo("eventos", "fecha"),
    esAdmin ? supabase.from("auditoria").select("*").order("ts", { ascending: false }).limit(800) : Promise.resolve({ data: [] }),
    // QR de pago (si la base todavía no tiene esta tabla, la app sigue funcionando sin ellos)
    leerTodo("qr_pagos", "creado_en").catch(() => []),
    leerTodo("comprobantes", "creado_en").catch(() => []),
    leerTodo("producto_videos", "creado_en").catch(() => []),
  ]);
  if (cfg.error) throw cfg.error;
  if ((auditoria as any).error) throw (auditoria as any).error;

  const fotosPor = {};
  fotos.forEach((f) => { (fotosPor[f.producto_id] = fotosPor[f.producto_id] || []).push({ id: f.id, ruta: f.ruta, url: fotoUrl(f.ruta), orden: f.orden, original: f.original || "", urlOriginal: f.original ? fotoUrl(f.original) : "" }); });
  const videosPor = {};
  (videos as any[]).forEach((v) => { (videosPor[v.producto_id] = videosPor[v.producto_id] || []).push({ id: v.id, ruta: v.ruta, url: fotoUrl(v.ruta), portada: v.portada || "", portadaUrl: v.portada ? fotoUrl(v.portada) : "", duracion: v.duracion == null ? null : num(v.duracion) }); });
  const itemsPor = {};
  items.forEach((i) => { (itemsPor[i.venta_id] = itemsPor[i.venta_id] || []).push({ id: i.id, productId: i.producto_id, precio: num(i.precio), costo: num(i.costo), activo: i.activo, precioLista: i.precio_lista == null ? null : num(i.precio_lista) }); });

  const c = cfg.data || {};
  return {
    comprobantes: (comprobantes as any[]).map((c) => ({ id: c.id, pedido: c.pedido_web, clienteId: c.cliente_id, ruta: c.ruta || "", archivos: (c.archivos && c.archivos.length ? c.archivos : c.ruta ? [c.ruta] : []), monto: c.monto == null ? null : num(c.monto), estado: c.estado, motivo: c.motivo || "", ventaId: c.venta_id, creado: c.creado_en, revisadoPor: c.revisado_por, revisadoEn: c.revisado_en })),
    qrs: (qrs as any[]).map((q) => ({ id: q.id, nombre: q.nombre, monto: q.monto == null ? null : num(q.monto), ruta: q.ruta, url: fotoUrl(q.ruta), creado: q.creado_en })),
    users: perfiles.map((u) => ({ id: u.id, nombre: u.nombre || u.email, email: u.email, rolKey: u.rol, rol: ROLES[u.rol] || u.rol, activo: u.activo, estado: u.activo ? "Activo" : "Sin acceso" })),
    providers: proveedores.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono || "", desde: isoLocal(new Date(p.creado_en)) })),
    lots: lotes.map((l) => ({ id: l.id, nombre: l.nombre, proveedorId: l.proveedor_id, fecha: l.fecha, origen: l.origen, pares: num(l.pares), compra: num(l.costo_compra), transporte: num(l.costo_transporte), otros: num(l.otros_gastos), socio: l.creado_por, obs: l.obs || "" })),
    products: productos.map((p) => {
      const ph = (fotosPor[p.id] || []).sort((a, b) => a.orden - b.orden);
      return {
        id: p.id, codigo: p.codigo, lote: p.lote_id, marca: p.marca, modelo: p.modelo, origen: p.origen, categoria: p.categoria,
        talla: num(p.talla), cm: p.cm == null ? null : num(p.cm), color: p.color, hex: colorHex(p.color), estadoFisico: p.estado_fisico, descripcion: p.descripcion || "", obs: p.obs || "",
        photos: ph, fotos: ph.length, videos: videosPor[p.id] || [], fechaIngreso: p.fecha_ingreso, creado: p.creado_en, costoCompra: num(p.costo_compra), costoTransporte: num(p.costo_transporte),
        precio: num(p.precio), estado: p.estado, socio: p.creado_por,
        bajaMotivo: p.baja_motivo || "", bajaEn: p.baja_en || null, bajaPor: p.baja_por || null, qrId: p.qr_id || null,
      };
    }),
    clients: clientes.map((x) => ({ id: x.id, nombre: x.nombre, telefono: x.telefono, zona: x.zona || "", direccion: x.direccion || "", obs: x.obs || "", fechaRegistro: isoLocal(new Date(x.creado_en)), cuentaWeb: !!x.usuario_id, email: x.email || "" })),
    reservations: reservas.map((r) => ({ id: r.id, productId: r.producto_id, clienteId: r.cliente_id, creado: r.creado_en, vence: r.vence, socio: r.creado_por, canal: r.canal, adelanto: num(r.adelanto), estado: r.estado, obs: r.obs || "", envio: r.envio || {}, ventaId: r.venta_id, web: !!r.web, tipoWeb: r.tipo_web || "", pedidoWeb: r.pedido_web || "" })),
    sales: ventas.map((s) => {
      const e = s.entrega || {};
      return {
        id: s.id, fecha: s.fecha, clienteId: s.cliente_id, canal: s.canal, socio: s.creado_por, estado: s.estado, obs: s.motivo || s.obs || "",
        items: itemsPor[s.id] || [], pedido: s.pedido, regalo: !!s.regalo,
        entrega: { tipo: e.tipo || "Recojo en punto", costo: num(e.costo), pagaCliente: !!e.pagaCliente, direccion: e.direccion || "", destino: e.destino || "", transportista: e.transportista || "", fechaEstimada: e.fechaEstimada || s.fecha },
      };
    }),
    payments: pagos.map((p) => ({ id: p.id, ventaId: p.venta_id, reservaId: p.reserva_id, fecha: p.fecha, monto: num(p.monto), metodo: p.metodo, socio: p.creado_por, anulado: p.anulado })),
    expenses: gastos.map((g) => ({ id: g.id, fecha: g.fecha, concepto: g.concepto, categoria: g.categoria, monto: num(g.monto), metodo: g.metodo, socio: g.creado_por, obs: g.obs || "", anulado: g.anulado, ventaId: g.venta_id })),
    otherIncome: otros.map((o) => ({ id: o.id, fecha: o.fecha, concepto: o.concepto, monto: num(o.monto), metodo: o.metodo, socio: o.creado_por })),
    events: eventos.map((e) => ({ id: e.id, titulo: e.titulo, tipo: e.tipo, fecha: e.fecha, hora: String(e.hora || "09:00").slice(0, 5), recordatorio: num(e.recordatorio), notas: e.notas || "", hecho: e.hecho, socio: e.creado_por })),
    audit: ((auditoria as any).data || []).map((a) => ({ id: a.id, ts: a.ts, user: a.usuario, accion: a.accion, entidad: a.entidad, detalle: a.detalle })),
    config: {
      canales: c.canales || [], metodos: c.metodos || [], destinos: c.destinos || [],
      vigenciaHoras: c.vigencia_horas || 48, diasBajaRotacion: c.dias_baja_rotacion || 30,
      whatsapp: c.whatsapp || "", paqueteria: c.paqueteria_cbba || "", paqueterias: Array.isArray(c.paqueterias) ? c.paqueterias : [],
    },
  };
}

/** Acciones del negocio. Cada una devuelve algo "verdadero" si salió bien. */
export function crearAcciones({ db, me, recargar, toast }) {
  const fallo = (e) => { toast(mensajeError(e), "err"); return null; };
  const auditar = (accion, entidad, detalle) => { supabase.rpc("auditar", { p_accion: accion, p_entidad: entidad || "", p_detalle: detalle || "" }).then(() => {}, () => {}); };
  const rpc = async (fn, args, ok?) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return fallo(error);
    if (ok) toast(typeof ok === "function" ? ok(data) : ok);
    await recargar();
    return data ?? true;
  };
  const prod = (id) => db.products.find((p) => p.id === id);

  async function subirFotos(productId, files, desde = 0) {
    let n = 0;
    for (let i = 0; i < files.length; i++) {
      const blob = await comprimirImagen(files[i]);
      const ruta = `${productId}/${Date.now()}-${i}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) { fallo(up.error); break; }
      const ins = await supabase.from("producto_fotos").insert({ producto_id: productId, ruta, orden: desde + i });
      if (ins.error) { fallo(ins.error); break; }
      n++;
    }
    return n;
  }

  // Sube videos: los reduce si pesan mucho, guarda una portada y los registra en el par
  // Revisa y reduce los videos ANTES de guardar nada (si uno no sirve, no se guarda el par a medias)
  async function prepararVideos(files, onEstado = (_t: string) => {}) {
    const listos = [];
    for (let i = 0; i < files.length; i++) {
      const pre = files.length > 1 ? `Video ${i + 1} de ${files.length}: ` : "";
      try { listos.push(await prepararVideo(files[i], (t) => onEstado(pre + t))); }
      catch (e) { onEstado(""); toast(`${files.length > 1 ? `Video ${i + 1}: ` : ""}${e?.message || "No se pudo leer ese video."} No se guardó nada.`, "err"); return null; }
    }
    return listos;
  }
  async function subirVideos(productId, files, onEstado = (_t: string) => {}, preparados = null) {
    let n = 0;
    const lista = preparados || (await prepararVideos(files, onEstado)) || [];
    for (let i = 0; i < lista.length; i++) {
      const pre = lista.length > 1 ? `Video ${i + 1} de ${lista.length}: ` : "";
      const v = lista[i];
      onEstado(pre + "Subiendo el video… puede tardar un poco");
      const base = `${productId}/videos/${Date.now()}-${i}`;
      const up = await supabase.storage.from(BUCKET).upload(`${base}.${v.ext}`, v.blob, { contentType: v.tipo, upsert: false });
      if (up.error) {
        const grande = /size|large|413/i.test(String(up.error.message || up.error));
        toast(grande ? `El video pesa más de lo que permite Supabase (${MAX_MB} MB). Graba uno más corto.` : "No se pudo subir el video. Revisa tu conexión e inténtalo otra vez.", "err");
        continue;
      }
      let portada = null;
      if (v.portada) {
        const pu = await supabase.storage.from(BUCKET).upload(`${base}-portada.jpg`, v.portada, { contentType: "image/jpeg", upsert: false });
        if (!pu.error) portada = `${base}-portada.jpg`;
      }
      const ins = await supabase.from("producto_videos").insert({ producto_id: productId, ruta: `${base}.${v.ext}`, portada, duracion: v.duracion ? Math.round(v.duracion * 10) / 10 : null });
      if (ins.error) { await supabase.storage.from(BUCKET).remove([`${base}.${v.ext}`, portada].filter(Boolean)); fallo(ins.error); break; }
      n++;
    }
    onEstado("");
    return n;
  }
  // Videos de pares que se borraron por completo (la base ya borró sus filas)
  async function limpiarVideos(ids) {
    const rutas = ids.flatMap((id) => (prod(id)?.videos || []).flatMap((v) => [v.ruta, v.portada].filter(Boolean)));
    if (!rutas.length) return;
    const { data } = await supabase.from("productos").select("id").in("id", ids);
    const siguen = new Set((data || []).map((x) => x.id));
    const borrar = ids.filter((id) => !siguen.has(id)).flatMap((id) => (prod(id)?.videos || []).flatMap((v) => [v.ruta, v.portada].filter(Boolean)));
    if (borrar.length) await supabase.storage.from(BUCKET).remove(borrar);
  }

  return {
    async addVideos(productId, files, onEstado) {
      const p = prod(productId);
      const n = await subirVideos(productId, files, onEstado);
      if (n) { auditar("Agregó videos", p?.codigo, `${n} video(s)`); toast(n === 1 ? "Video agregado." : `${n} videos agregados.`); }
      await recargar();
      return n;
    },
    async deleteVideo(video, codigo) {
      const del = await supabase.from("producto_videos").delete().eq("id", video.id);
      if (del.error) return fallo(del.error);
      await supabase.storage.from(BUCKET).remove([video.ruta, video.portada].filter(Boolean));
      auditar("Eliminó video", codigo, "");
      toast("Video eliminado."); await recargar(); return true;
    },
    async reserve(d) {
      return rpc("reservar_par", {
        p_producto: d.productId, p_cliente: d.clienteId || null, p_canal: d.canal, p_horas: Number(d.horas) || 48,
        p_adelanto: Number(d.adelanto) || 0, p_metodo: d.metodo,
        p_envio: { entrega: d.entrega, delivery: Number(d.delivery) || 0, pagaCliente: !!d.pagaCliente, direccion: d.direccion || "", destino: d.destino || "", fechaEnvio: d.fechaEnvio || "", transportista: d.transportista || "" },
        p_obs: d.obs || "",
      }, (id) => `${prod(d.productId)?.codigo || "Par"} reservado (${id}) por ${d.horas} horas.`);
    },
    async cancelReservation(id, motivo = "") {
      const r = db.reservations.find((x) => x.id === id);
      return rpc("cancelar_reserva", { p_reserva: id, p_motivo: motivo }, `Reserva cancelada. ${prod(r?.productId)?.codigo || "El par"} volvió al catálogo de disponibles.`);
    },
    async sell(data) {
      const cli = db.clients.find((c) => c.id === data.clienteId);
      const recojo = data.entrega === "Recojo en punto";
      return rpc("registrar_venta", {
        p_cliente: data.clienteId || null, p_canal: data.canal,
        p_items: data.items.map((i) => ({ producto_id: i.productId, precio: Number(i.precio) || 0 })),
        p_reservas: data.reservaIds || [], p_pago: Number(data.pago) || 0, p_metodo: data.metodo,
        p_entrega: {
          tipo: data.entrega, costo: recojo ? 0 : Number(data.delivery) || 0, pagaCliente: !!data.pagaCliente,
          direccion: data.direccion || cli?.direccion || "", destino: data.entrega === "Encomienda" ? data.destino : "",
          transportista: data.transportista || "", fechaEstimada: recojo ? TODAY : data.fechaEnvio || addDays(TODAY, 1),
        },
        p_obs: data.obs || "",
        p_regalo: !!data.regalo, p_entregado: recojo && !!data.entregado,
      }, (id) => data.regalo
        ? `Regalo ${id} registrado${recojo && data.entregado ? " y entregado" : ""}.`
        : recojo && data.entregado ? `Venta ${id} registrada y entregada.` : `Venta ${id} registrada. El pedido quedó pendiente de preparación.`);
    },
    async editSale(ventaId, cambios) {
      const r = await rpc("editar_venta", {
        p_venta: ventaId, p_regalo: !!cambios.regalo,
        p_precios: cambios.regalo ? [] : (cambios.precios || []).map((x) => ({ id: x.id, precio: Number(x.precio) || 0 })),
        p_canal: cambios.canal || null, p_pedido: cambios.pedido || null,
      });
      if (!r) return false;
      const dev = Number(r?.devuelto) || 0;
      toast(`${ventaId} actualizada.${dev > 0 ? ` Los pagos de ${bs(dev)} quedaron como devueltos.` : ""}`);
      return true;
    },
    async pay(ventaId, monto, metodo) {
      return rpc("registrar_pago", { p_venta: ventaId, p_monto: Number(monto) || 0, p_metodo: metodo }, `Pago de ${bs(monto)} registrado en ${ventaId}.`);
    },
    async voidSale(ventaId, motivo) {
      return rpc("anular_venta", { p_venta: ventaId, p_motivo: motivo }, `${ventaId} anulada. Los pares volvieron al inventario y los pagos quedaron como reembolsados.`);
    },
    async advanceOrder(ventaId) {
      return rpc("avanzar_pedido", { p_venta: ventaId }, (st) => `${ventaId}: ${String(st).toLowerCase()}.`);
    },
    async addExpense(e) {
      const { error } = await supabase.from("gastos").insert({ fecha: e.fecha, concepto: e.concepto.trim(), categoria: e.categoria, monto: Number(e.monto), metodo: e.metodo, obs: e.obs || "" });
      if (error) return fallo(error);
      auditar("Registró gasto", e.categoria, `${e.concepto} — ${bs(e.monto)}`);
      toast("Gasto registrado."); await recargar(); return true;
    },
    async annulExpense(id) {
      const g = db.expenses.find((x) => x.id === id);
      const { error } = await supabase.from("gastos").update({ anulado: true }).eq("id", id);
      if (error) return fallo(error);
      auditar("Anuló gasto", g?.categoria, `${g?.concepto} — ${bs(g?.monto)}`);
      toast("Gasto anulado."); await recargar(); return true;
    },
    async addIncome(e) {
      const { error } = await supabase.from("otros_ingresos").insert({ fecha: TODAY, concepto: e.concepto.trim(), monto: Number(e.monto), metodo: e.metodo });
      if (error) return fallo(error);
      auditar("Registró otro ingreso", "Finanzas", `${e.concepto} — ${bs(e.monto)}`);
      toast("Ingreso registrado."); await recargar(); return true;
    },
    async addClient(c) {
      const tel = String(c.telefono || "").replace(/\s+/g, "");
      const { data, error } = await supabase.from("clientes").insert({ nombre: c.nombre.trim(), telefono: tel, zona: c.zona || "", direccion: c.direccion || "", obs: c.obs || "" }).select().single();
      if (error) return fallo(error);
      auditar("Registró cliente", data.nombre, data.telefono);
      toast(`Cliente ${data.nombre} registrado.`);
      await recargar();
      return { id: data.id, nombre: data.nombre, telefono: data.telefono, zona: data.zona, direccion: data.direccion };
    },
    async updateClient(id, c) {
      const { error } = await supabase.from("clientes").update({ nombre: c.nombre.trim(), telefono: String(c.telefono).replace(/\s+/g, ""), zona: c.zona || "", direccion: c.direccion || "", obs: c.obs || "" }).eq("id", id);
      if (error) return fallo(error);
      auditar("Editó cliente", c.nombre, c.telefono);
      toast("Cliente actualizado."); await recargar(); return true;
    },
    async saveLot(l, prov, id = null) {
      return rpc("guardar_lote", {
        p_id: id, p_nombre: l.nombre, p_fecha: l.fecha || null, p_origen: l.origen, p_pares: Number(l.pares) || 0,
        p_compra: Number(l.compra) || 0, p_transporte: Number(l.transporte) || 0, p_otros: Number(l.otros) || 0, p_obs: l.obs || "",
        p_proveedor_id: prov.id || null, p_prov_nombre: prov.nombre || "", p_prov_telefono: prov.telefono || "",
      }, (lid) => (id ? `Lote ${lid} actualizado.` : `Lote ${lid} registrado. Ya puedes cargar sus pares en Inventario.`));
    },
    async updateProvider(id, nombre, telefono) {
      const { error } = await supabase.from("proveedores").update({ nombre: nombre.trim(), telefono: telefono.trim() }).eq("id", id);
      if (error) return fallo(error);
      auditar("Editó proveedor", nombre, telefono);
      toast("Proveedor actualizado."); await recargar(); return true;
    },
    async saveProduct(p, files = [], id = null, vids = [], onEstado = (_t: string) => {}) {
      const listos = vids.length ? await prepararVideos(vids, onEstado) : [];
      if (!listos) return false; // un video no sirvió: no se guarda nada y la ventana sigue abierta
      const fila = {
        lote_id: p.lote, marca: p.marca.trim(), modelo: (p.modelo || "").trim(), origen: p.origen, categoria: p.categoria,
        talla: Number(p.talla), cm: String(p.cm ?? "").trim() === "" ? null : Number(String(p.cm).replace(",", ".")),
        color: String(p.color || "").trim(), estado_fisico: p.estadoFisico, descripcion: p.descripcion || "", obs: p.obs || "", precio: Number(p.precio),
      };
      const q = id ? supabase.from("productos").update(fila).eq("id", id).select().single() : supabase.from("productos").insert(fila).select().single();
      const { data, error } = await q;
      if (error) return fallo(error);
      const subidas = files.length ? await subirFotos(data.id, files, id ? (prod(id)?.fotos || 0) : 0) : 0;
      const nv = listos.length ? await subirVideos(data.id, [], onEstado, listos) : 0;
      if (listos.length && nv < listos.length) {
        toast(`${data.codigo} ${id ? "se actualizó" : "se guardó"}, pero ${listos.length - nv === 1 ? "un video no se pudo subir" : "algunos videos no se pudieron subir"}. Agrégalo desde la ficha del par (no vuelvas a crear el par).`, "err");
      }
      auditar(id ? "Editó producto" : "Registró producto", data.codigo, `${data.marca} ${data.modelo} T${data.talla}${subidas ? ` · ${subidas} foto(s)` : ""}`);
      if (!(listos.length && nv < listos.length)) toast(id ? `${data.codigo} actualizado${nv ? ` con ${nv} video(s) nuevo(s)` : ""}.` : `${data.codigo} agregado al inventario${subidas ? ` con ${subidas} foto(s)` : ""}${nv ? ` y ${nv} video(s)` : ""}.`);
      await recargar();
      return data.codigo;
    },
    async addPhotos(productId, files) {
      const p = prod(productId);
      const n = await subirFotos(productId, files, p?.fotos || 0);
      if (n) { auditar("Agregó fotos", p?.codigo, `${n} foto(s)`); toast(`${n} foto(s) agregada(s).`); }
      await recargar();
      return n;
    },
    // ---------- QR de pago ----------
    async refrescar() { await recargar(); },
    async createQR(file, nombre, monto, productIds = [], { silencioso = false } = {}) {
      // Los QR casi no se comprimen: tienen que poder escanearse
      const grande = file.size > 1.5 * 1024 * 1024;
      const blob = grande ? await comprimirImagen(file, 1400, 0.95) : file;
      const ext = grande ? "jpg" : (String(file.name || "").split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const ruta = `qr/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type || "image/png", upsert: false });
      if (up.error) return fallo(up.error);
      const { data: id, error } = await supabase.rpc("crear_qr", { p_nombre: nombre || "", p_monto: monto === "" || monto == null ? null : Number(monto), p_ruta: ruta });
      if (error) { await supabase.storage.from(BUCKET).remove([ruta]); return fallo(error); }
      if (productIds.length) {
        const r = await supabase.rpc("asignar_qr", { p_qr: id, p_productos: productIds, p_reemplazar: false });
        if (r.error) { fallo(r.error); if (!silencioso) await recargar(); return id; }
      }
      if (silencioso) return id;
      toast(productIds.length ? `QR guardado y asignado a ${productIds.length} par${productIds.length === 1 ? "" : "es"}.` : "QR guardado.");
      await recargar();
      return id;
    },
    async editQR(qr, nombre, monto, { silencioso = false } = {}) {
      const args = { p_qr: qr.id, p_nombre: nombre, p_monto: monto === "" || monto == null ? null : Number(monto) };
      if (!silencioso) return rpc("editar_qr", args, "QR actualizado.");
      const { error } = await supabase.rpc("editar_qr", args);
      if (error) return fallo(error);
      return true;
    },
    async assignQR(qrId, productIds, reemplazar = false, { silencioso = false } = {}) {
      if (silencioso) {
        const { data, error } = await supabase.rpc("asignar_qr", { p_qr: qrId, p_productos: productIds, p_reemplazar: reemplazar });
        if (error) { fallo(error); return null; }
        return data;
      }
      const n = await rpc("asignar_qr", { p_qr: qrId, p_productos: productIds, p_reemplazar: reemplazar });
      if (n === null) return false;
      toast(qrId ? `QR asignado a ${productIds.length} par${productIds.length === 1 ? "" : "es"}.` : `Se quitó el QR de ${productIds.length} par${productIds.length === 1 ? "" : "es"}.`);
      return true;
    },
    async deleteQR(qr) {
      const { data, error } = await supabase.rpc("eliminar_qr", { p_qr: qr.id });
      if (error) return fallo(error);
      if (data) await supabase.storage.from(BUCKET).remove([data]);
      toast("QR eliminado. Los pares que lo usaban quedaron sin QR.");
      await recargar();
      return true;
    },
    // Comprobantes de pago de la tienda (carpeta privada: se ven con un enlace temporal)
    async urlComprobante(ruta) {
      if (!ruta) return "";
      const { data, error } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrl(ruta, 600);
      if (error) { fallo(error); return ""; }
      return data?.signedUrl || "";
    },
    async aprobarPago(c, { monto, metodo, fecha, guia }) {
      const { data, error } = await supabase.rpc("aprobar_comprobante", { p_comprobante: c.id, p_monto: monto === "" || monto == null ? null : Number(monto), p_metodo: metodo, p_fecha_envio: fecha || null, p_guia: guia || "" });
      if (error) return fallo(error);
      // El pago ya está en el banco: la foto del comprobante se borra
      const rutas = [...new Set([...(data?.rutas || []), ...(c.archivos || []), data?.ruta].filter(Boolean))];
      if (rutas.length) await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas).catch(() => {});
      toast(`Pago aprobado. Se registró la venta ${data?.venta || ""} y se borró el comprobante.`);
      await recargar();
      return data?.venta || true;
    },
    async rechazarPago(c, motivo) {
      const { data, error } = await supabase.rpc("rechazar_comprobante", { p_comprobante: c.id, p_motivo: motivo });
      if (error) return fallo(error);
      const rutas = [...new Set([...String(data || "").split("|"), ...(c.archivos || [])].filter(Boolean))];
      if (rutas.length) await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas).catch(() => {});
      toast("Comprobante rechazado. El cliente verá el motivo y podrá subir otro.");
      await recargar();
      return true;
    },
    async programarEnvio(ventaId, fecha, guia) {
      return rpc("programar_envio", { p_venta: ventaId, p_fecha: fecha || null, p_guia: guia || "" }, "Envío actualizado. El cliente ya ve la fecha.");
    },
    async reorderPhotos(productId, ids, portada = false) {
      const { error } = await supabase.rpc("ordenar_fotos", { p_producto: productId, p_ids: ids });
      if (error) return fallo(error);
      toast(portada ? "Portada cambiada." : "Orden de fotos guardado.");
      await recargar();
      return true;
    },
    // Cambiar fotos ya subidas por su versión ajustada (cada una mantiene su lugar y la portada sigue igual)
    async replacePhotos(productId, cambios, codigo) {
      let n = 0;
      for (const { photo, file } of cambios) {
        const ruta = `${productId}/${Date.now()}-${n}-r.jpg`;
        const up = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: "image/jpeg", upsert: false });
        if (up.error) { fallo(up.error); break; }
        // Se guarda cuál es la foto original para poder volver a ajustarla las veces que quieras sin perder calidad
        let original = photo.original || photo.ruta;
        let ins = await supabase.from("producto_fotos").insert({ producto_id: productId, ruta, orden: photo.orden ?? 0, original });
        if (ins.error && /original/.test(String(ins.error.message || ""))) {
          // La base de datos todavía no tiene la columna "original": se ajusta como antes
          original = null;
          ins = await supabase.from("producto_fotos").insert({ producto_id: productId, ruta, orden: photo.orden ?? 0 });
        }
        if (ins.error) { await supabase.storage.from(BUCKET).remove([ruta]); fallo(ins.error); break; }
        await supabase.from("producto_fotos").delete().eq("id", photo.id);
        // La versión anterior se borra; la original se conserva
        if (photo.ruta !== original) await supabase.storage.from(BUCKET).remove([photo.ruta]);
        n++;
      }
      if (n) { auditar("Ajustó fotos", codigo, `${n} foto(s)`); toast(n === 1 ? "Foto ajustada." : `${n} fotos ajustadas.`); }
      await recargar();
      return n > 0;
    },
    async replacePhoto(productId, photo, file, codigo) {
      return this.replacePhotos(productId, [{ photo, file }], codigo);
    },
    async deletePhoto(photo, codigo) {
      const del = await supabase.from("producto_fotos").delete().eq("id", photo.id);
      if (del.error) return fallo(del.error);
      await supabase.storage.from(BUCKET).remove([photo.ruta, photo.original].filter(Boolean));
      auditar("Eliminó foto", codigo, "");
      toast("Foto eliminada."); await recargar(); return true;
    },
    async deleteProducts(ids, motivo, nota = "") {
      const { data, error } = await supabase.rpc("eliminar_pares", { p_ids: ids, p_motivo: motivo, p_nota: nota });
      if (error) return fallo(error);
      const r = data || {};
      if (r.rutas && r.rutas.length) await supabase.storage.from(BUCKET).remove(r.rutas);
      if (r.borrados) await limpiarVideos(ids);
      const partes = [];
      if (r.borrados) partes.push(`${r.borrados} par(es) eliminado(s) por completo`);
      if (r.baja) partes.push(`${r.baja} par(es) dado(s) de baja (están en la pestaña Eliminados)`);
      if (r.omitidos && r.omitidos.length) partes.push(`no se tocaron ${r.omitidos.join(", ")} porque ya no estaban disponibles`);
      toast((partes.join("; ") || "No se eliminó ningún par") + ".", r.omitidos && r.omitidos.length ? "err" : "ok");
      await recargar();
      return true;
    },
    async restoreProduct(p) {
      return rpc("restaurar_par", { p_id: p.id }, `${p.codigo} volvió a Disponibles.`);
    },
    async deleteProduct(p) {
      const { data, error } = await supabase.rpc("eliminar_producto", { p_id: p.id });
      if (error) return fallo(error);
      if (data && data.length) await supabase.storage.from(BUCKET).remove(data);
      await limpiarVideos([p.id]);
      toast(`${p.codigo} eliminado del inventario.`); await recargar(); return true;
    },
    async addDestino(name) {
      if (db.config.destinos.includes(name)) return true;
      const { error } = await supabase.rpc("agregar_destino", { p_nombre: name });
      if (error) return fallo(error);
      toast(`“${name}” agregado a los destinos de encomienda.`); await recargar(); return true;
    },
    async setConfig(cfg) {
      const fila: any = {};
      if (cfg.canales) fila.canales = cfg.canales;
      if (cfg.metodos) fila.metodos = cfg.metodos;
      if (cfg.destinos) fila.destinos = cfg.destinos;
      if (cfg.vigenciaHoras) fila.vigencia_horas = cfg.vigenciaHoras;
      if (cfg.diasBajaRotacion) fila.dias_baja_rotacion = cfg.diasBajaRotacion;
      if (cfg.whatsapp !== undefined) fila.whatsapp = String(cfg.whatsapp).replace(/[^0-9+]/g, "");
      if (cfg.paqueteria !== undefined) fila.paqueteria_cbba = String(cfg.paqueteria).trim().slice(0, 300);
      if (cfg.paqueterias !== undefined) fila.paqueterias = cfg.paqueterias;
      const { error } = await supabase.from("configuracion").update(fila).eq("id", 1);
      if (error) return fallo(error);
      toast("Configuración guardada."); await recargar(); return true;
    },
    async saveEvent(ev, semanas = 0) {
      const fila = { titulo: ev.titulo.trim(), tipo: ev.tipo, fecha: ev.fecha, hora: ev.hora || "09:00", recordatorio: Number(ev.recordatorio) || 0, notas: ev.notas || "" };
      if (ev.id) {
        const { error } = await supabase.from("eventos").update(fila).eq("id", ev.id);
        if (error) return fallo(error);
        toast("Actividad actualizada."); await recargar(); return true;
      }
      const filas = Array.from({ length: 1 + Number(semanas) }, (_, k) => ({ ...fila, fecha: addDays(ev.fecha, k * 7) }));
      const { error } = await supabase.from("eventos").insert(filas);
      if (error) return fallo(error);
      auditar("Agendó actividad", fila.titulo, `${fdate(ev.fecha)} ${fila.hora}${semanas > 0 ? ` y ${semanas} semanas más` : ""}`);
      toast(filas.length > 1 ? `${filas.length} actividades agendadas, una por semana.` : `Actividad agendada para el ${fdate(ev.fecha)}.`);
      await recargar(); return true;
    },
    async toggleEvent(id) {
      const ev = db.events.find((x) => x.id === id);
      const { error } = await supabase.from("eventos").update({ hecho: !ev.hecho }).eq("id", id);
      if (error) return fallo(error);
      await recargar(); return true;
    },
    async deleteEvent(id) {
      const { error } = await supabase.from("eventos").delete().eq("id", id);
      if (error) return fallo(error);
      toast("Actividad eliminada."); await recargar(); return true;
    },
    async createUser(u) {
      return rpc("admin_crear_usuario", { p_email: u.email, p_password: u.password, p_nombre: u.nombre, p_rol: u.rol }, `Usuario ${u.email} creado. Ya puede iniciar sesión.`);
    },
    async updateUser(id, u) {
      return rpc("admin_actualizar_usuario", { p_id: id, p_nombre: u.nombre, p_rol: u.rol, p_activo: u.activo }, "Usuario actualizado.");
    },
    async setUserPassword(id, password) {
      return rpc("admin_cambiar_password", { p_id: id, p_password: password }, "Contraseña cambiada.");
    },
    async changeMyPassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return fallo(error);
      toast("Tu contraseña se cambió."); return true;
    },
  };
}

/** Archivos (fotos y videos) de pares que la base de datos eliminó: se borran de la carpeta "productos". */
export async function limpiarArchivosPendientes() {
  try {
    const { data, error } = await supabase.from("archivos_por_borrar").select("ruta").limit(500);
    if (error || !data || !data.length) return;
    const rutas = data.map((x) => x.ruta);
    const r = await supabase.storage.from(BUCKET).remove(rutas);
    if (r.error) return;
    await supabase.from("archivos_por_borrar").delete().in("ruta", rutas);
  } catch {}
}
