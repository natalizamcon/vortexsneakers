// Carga los datos de Supabase y los convierte al formato que usan las pantallas.
// Las acciones llaman a las operaciones seguras de la base de datos.
import { supabase, fotoUrl, mensajeError, comprimirImagen, BUCKET } from "./supabase";
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
  users: [], providers: [], lots: [], products: [], clients: [], reservations: [], sales: [], payments: [],
  expenses: [], otherIncome: [], events: [], audit: [],
  config: { canales: [], metodos: [], destinos: [], vigenciaHoras: 48, diasBajaRotacion: 30 },
};

export async function cargarTodo(esAdmin: boolean) {
  const [perfiles, cfg, proveedores, lotes, productos, fotos, clientes, reservas, ventas, items, pagos, gastos, otros, eventos, auditoria] = await Promise.all([
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
  ]);
  if (cfg.error) throw cfg.error;
  if ((auditoria as any).error) throw (auditoria as any).error;

  const fotosPor = {};
  fotos.forEach((f) => { (fotosPor[f.producto_id] = fotosPor[f.producto_id] || []).push({ id: f.id, ruta: f.ruta, url: fotoUrl(f.ruta), orden: f.orden }); });
  const itemsPor = {};
  items.forEach((i) => { (itemsPor[i.venta_id] = itemsPor[i.venta_id] || []).push({ id: i.id, productId: i.producto_id, precio: num(i.precio), costo: num(i.costo), activo: i.activo }); });

  const c = cfg.data || {};
  return {
    users: perfiles.map((u) => ({ id: u.id, nombre: u.nombre || u.email, email: u.email, rolKey: u.rol, rol: ROLES[u.rol] || u.rol, activo: u.activo, estado: u.activo ? "Activo" : "Sin acceso" })),
    providers: proveedores.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono || "", desde: isoLocal(new Date(p.creado_en)) })),
    lots: lotes.map((l) => ({ id: l.id, nombre: l.nombre, proveedorId: l.proveedor_id, fecha: l.fecha, origen: l.origen, pares: num(l.pares), compra: num(l.costo_compra), transporte: num(l.costo_transporte), otros: num(l.otros_gastos), socio: l.creado_por, obs: l.obs || "" })),
    products: productos.map((p) => {
      const ph = (fotosPor[p.id] || []).sort((a, b) => a.orden - b.orden);
      return {
        id: p.id, codigo: p.codigo, lote: p.lote_id, marca: p.marca, modelo: p.modelo, origen: p.origen, categoria: p.categoria,
        talla: num(p.talla), color: p.color, hex: colorHex(p.color), estadoFisico: p.estado_fisico, descripcion: p.descripcion || "", obs: p.obs || "",
        photos: ph, fotos: ph.length, fechaIngreso: p.fecha_ingreso, costoCompra: num(p.costo_compra), costoTransporte: num(p.costo_transporte),
        precio: num(p.precio), estado: p.estado, socio: p.creado_por,
      };
    }),
    clients: clientes.map((x) => ({ id: x.id, nombre: x.nombre, telefono: x.telefono, zona: x.zona || "", direccion: x.direccion || "", obs: x.obs || "", fechaRegistro: isoLocal(new Date(x.creado_en)) })),
    reservations: reservas.map((r) => ({ id: r.id, productId: r.producto_id, clienteId: r.cliente_id, creado: r.creado_en, vence: r.vence, socio: r.creado_por, canal: r.canal, adelanto: num(r.adelanto), estado: r.estado, obs: r.obs || "", envio: r.envio || {}, ventaId: r.venta_id })),
    sales: ventas.map((s) => {
      const e = s.entrega || {};
      return {
        id: s.id, fecha: s.fecha, clienteId: s.cliente_id, canal: s.canal, socio: s.creado_por, estado: s.estado, obs: s.motivo || s.obs || "",
        items: itemsPor[s.id] || [], pedido: s.pedido,
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

  return {
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
      }, (id) => `Venta ${id} registrada. El pedido quedó pendiente de preparación.`);
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
    async saveProduct(p, files = [], id = null) {
      const fila = {
        lote_id: p.lote, marca: p.marca.trim(), modelo: (p.modelo || "").trim(), origen: p.origen, categoria: p.categoria,
        talla: Number(p.talla), color: p.color, estado_fisico: p.estadoFisico, descripcion: p.descripcion || "", obs: p.obs || "", precio: Number(p.precio),
      };
      const q = id ? supabase.from("productos").update(fila).eq("id", id).select().single() : supabase.from("productos").insert(fila).select().single();
      const { data, error } = await q;
      if (error) return fallo(error);
      const subidas = files.length ? await subirFotos(data.id, files, id ? (prod(id)?.fotos || 0) : 0) : 0;
      auditar(id ? "Editó producto" : "Registró producto", data.codigo, `${data.marca} ${data.modelo} T${data.talla}${subidas ? ` · ${subidas} foto(s)` : ""}`);
      toast(id ? `${data.codigo} actualizado.` : `${data.codigo} agregado al inventario${subidas ? ` con ${subidas} foto(s)` : ""}.`);
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
    async deletePhoto(photo, codigo) {
      const del = await supabase.from("producto_fotos").delete().eq("id", photo.id);
      if (del.error) return fallo(del.error);
      await supabase.storage.from(BUCKET).remove([photo.ruta]);
      auditar("Eliminó foto", codigo, "");
      toast("Foto eliminada."); await recargar(); return true;
    },
    async deleteProduct(p) {
      const { data, error } = await supabase.rpc("eliminar_producto", { p_id: p.id });
      if (error) return fallo(error);
      if (data && data.length) await supabase.storage.from(BUCKET).remove(data);
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
