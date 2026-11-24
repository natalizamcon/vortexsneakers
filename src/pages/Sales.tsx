import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star, Gift, PackageCheck } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV, itemLista, norm } from "../lib/utils";
import { SearchBox } from "../components/search";
import { entregaWeb, ComprobantesPendientes } from "./Pagos";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function ClientPicker({ db, value, onChange, actions }) {
  const [adding, setAdding] = useState(false);
  const [busy, run] = useBusy();
  const [c, setC] = useState({ nombre: "", telefono: "", zona: "Cercado", direccion: "" });
  const tel = c.telefono.replace(/\s+/g, "");
  const dup = tel.length >= 7 && db.clients.find((x) => x.telefono === tel);
  const elegido = value && db.clients.find((x) => x.id === value);
  // Compras por cliente y los más recientes primero (para mostrar sin escribir nada)
  const compras = useMemo(() => {
    const o = {};
    db.sales.filter((x) => x.estado === "Activa").forEach((x) => { const k = x.clienteId; o[k] = o[k] || { n: 0, ult: "" }; o[k].n++; if (x.fecha > o[k].ult) o[k].ult = x.fecha; });
    return o;
  }, [db.sales]);
  const recientes = useMemo(() => [...db.clients].sort((a, b) => String(compras[b.id]?.ult || b.fechaRegistro).localeCompare(String(compras[a.id]?.ult || a.fechaRegistro))), [db.clients, compras]);
  const nuevo = (q = "") => {
    const soloNumeros = /^[\d\s+]+$/.test(q.trim());
    setC({ nombre: soloNumeros ? "" : q.trim(), telefono: soloNumeros ? q.replace(/\s+/g, "") : "", zona: "Cercado", direccion: "" });
    setAdding(true);
  };

  if (adding) return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-700">Nuevo cliente</div>
      <div className="grid grid-cols-2 gap-2"><Input placeholder="Nombre completo" value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} /><Input type="tel" inputMode="tel" placeholder="Teléfono" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} /></div>
      {dup && <p className="text-xs text-rose-600">Ese teléfono ya pertenece a {dup.nombre}. <button className="underline" onClick={() => { onChange(dup.id); setAdding(false); }}>Usar ese cliente</button></p>}
      <div className="flex gap-2 justify-end"><Btn size="sm" variant="ghost" onClick={() => setAdding(false)}>Volver</Btn><Btn size="sm" disabled={busy || !c.nombre.trim() || !tel || !!dup} onClick={() => run(async () => { const n = await actions.addClient({ ...c, telefono: tel, direccion: c.direccion || `Zona ${c.zona}, Cochabamba` }); if (n) { onChange(n.id); setAdding(false); } })}>{busy ? <Spinner /> : null} Guardar cliente</Btn></div>
    </div>
  );

  if (elegido) return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
      <div className="w-9 h-9 rounded-full vx-grad text-white grid place-items-center text-xs font-bold shrink-0">{elegido.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("")}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{elegido.nombre}</div>
        <div className="text-xs text-slate-500 truncate">{elegido.telefono}{elegido.zona ? ` · ${elegido.zona}` : ""}{compras[elegido.id] ? ` · ${compras[elegido.id].n} compra${compras[elegido.id].n === 1 ? "" : "s"}` : " · cliente nuevo"}</div>
      </div>
      <Btn size="sm" variant="outline" onClick={() => onChange("")}>Cambiar</Btn>
    </div>
  );

  return (
    <SearchBox
      items={db.clients} inicial={recientes} label="Buscar comprador"
      getText={(x) => `${x.nombre} ${x.telefono} ${x.zona}`}
      placeholder="Busca por nombre o teléfono"
      sinResultados="Nadie coincide. Puedes registrarlo como cliente nuevo."
      onPick={(x) => onChange(x.id)}
      render={(x) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-sm font-medium truncate">{x.nombre}</div><div className="text-xs text-slate-500 truncate">{x.telefono}{x.zona ? ` · ${x.zona}` : ""}</div></div>
          {compras[x.id] && <span className="text-xs text-slate-500 shrink-0">{compras[x.id].n} compra{compras[x.id].n === 1 ? "" : "s"}</span>}
        </div>
      )}
      footer={(q) => (
        <button type="button" onClick={() => nuevo(q)} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50">
          <UserPlus size={15} /> {q.trim() ? `Registrar “${q.trim()}” como cliente nuevo` : "Registrar un cliente nuevo"}
        </button>
      )}
    />
  );
}

export const envioInicial = (db) => ({ entrega: "Delivery Cochabamba", delivery: 12, pagaCliente: false, direccion: "", destino: db.config.destinos[0] || "", fechaEnvio: addDays(TODAY, 1), transportista: "" });

export function DeliveryFields({ db, d, setD, actions, entregadoOpcion = false }) {
  const [adding, setAdding] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const setTipo = (t) => setD({ ...d, entrega: t, delivery: t === "Recojo en punto" ? 0 : t === "Encomienda" ? 25 : 12, pagaCliente: t === "Encomienda", entregado: t === "Recojo en punto" ? d.entregado : false });
  const saveDestino = async () => { const n = nuevo.trim(); if (await actions.addDestino(n)) { setD({ ...d, destino: n }); setNuevo(""); setAdding(false); } };
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Truck size={14} /> Entrega</div>
      <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-lg p-1" role="radiogroup" aria-label="Tipo de entrega">
        {TIPOS_ENTREGA.map(([t, l]) => <button key={t} type="button" role="radio" aria-checked={d.entrega === t} onClick={() => setTipo(t)} className={`text-sm py-1.5 rounded-md ${d.entrega === t ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500"}`}>{l}</button>)}
      </div>
      {d.entrega === "Encomienda" && (
        <Field label="Departamento o lugar de destino" hint={adding ? "Se guarda en la lista para las próximas encomiendas." : null}>
          {adding ? (
            <div className="flex gap-2">
              <input autoFocus className={inputCls} placeholder="Ej.: Montero, Riberalta, Yacuiba" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nuevo.trim()) saveDestino(); }} />
              <Btn variant="ghost" onClick={() => setAdding(false)}>Volver</Btn>
              <Btn disabled={!nuevo.trim()} onClick={saveDestino}>Agregar</Btn>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={d.destino} onChange={(e) => setD({ ...d, destino: e.target.value })} options={db.config.destinos} />
              <Btn variant="outline" className="whitespace-nowrap" onClick={() => setAdding(true)}><Plus size={15} /> Otro lugar</Btn>
            </div>
          )}
        </Field>
      )}
      {d.entrega !== "Recojo en punto" ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Fecha de envío"><Input type="date" min={TODAY} value={d.fechaEnvio} onChange={(e) => setD({ ...d, fechaEnvio: e.target.value })} /></Field>
          <Field label="Costo de envío (Bs)"><Input type="number" value={d.delivery} onChange={(e) => setD({ ...d, delivery: e.target.value })} /></Field>
          <Field label="¿Quién paga el envío?"><Select value={d.pagaCliente ? "c" : "n"} onChange={(e) => setD({ ...d, pagaCliente: e.target.value === "c" })} options={[{ value: "n", label: "El negocio (gasto)" }, { value: "c", label: "El cliente" }]} /></Field>
        </div>
      ) : entregadoOpcion ? (
        <label className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer ${d.entregado ? "bg-cyan-50 ring-1 ring-cyan-200" : "bg-slate-50"}`}>
          <input type="checkbox" className="mt-0.5 w-5 h-5 accent-purple-700" checked={!!d.entregado} onChange={(e) => setD({ ...d, entregado: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold text-slate-900 flex items-center gap-1.5"><PackageCheck size={16} className="text-cyan-700" /> Ya se entregó</span>
            <span className="block text-xs text-slate-500">La venta se hizo y el cliente se llevó el par en ese momento (por ejemplo, en la tienda). No queda como pedido pendiente.</span>
          </span>
        </label>
      ) : <p className="text-xs text-slate-500">El cliente recoge el par en el punto de entrega. No hay costo de envío.</p>}
      {d.entrega === "Delivery Cochabamba" && <Field label="Dirección de entrega"><Input value={d.direccion} placeholder="Si se deja vacío, se usa la dirección del cliente" onChange={(e) => setD({ ...d, direccion: e.target.value })} /></Field>}
      {d.entrega === "Encomienda" && <Field label="Empresa de encomienda (opcional)"><Input value={d.transportista} placeholder="Ej.: flota o empresa de transporte" onChange={(e) => setD({ ...d, transportista: e.target.value })} /></Field>}
    </div>
  );
}

export function ReserveModal({ db, productId, onClose, actions }) {
  const p = db.products.find((x) => x.id === productId);
  const [busy, run] = useBusy();
  if (!p) return null;
  const [d, setD] = useState({ clienteId: "", canal: db.config.canales[0] || "", horas: db.config.vigenciaHoras, adelanto: "", metodo: "QR", obs: "", ...envioInicial(db) });
  return (
    <Modal title={`Reservar ${p.codigo}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn variant="lila" disabled={busy || !d.clienteId} onClick={() => run(async () => { if (await actions.reserve({ ...d, productId })) onClose(); })}>{busy ? <Spinner /> : null} Reservar par</Btn></>}>
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><div className="w-16 h-12 rounded-lg overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div><div><div className="font-semibold text-sm">{p.marca} {p.modelo}</div><div className="text-xs text-slate-500">Talla {p.talla} · {bs(p.precio)}</div></div></div>
      <Field label="Cliente"><ClientPicker db={db} value={d.clienteId} onChange={(v) => setD({ ...d, clienteId: v })} actions={actions} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Canal"><Select value={d.canal} onChange={(e) => setD({ ...d, canal: e.target.value })} options={db.config.canales} /></Field>
        <Field label="Vigencia"><Select value={d.horas} onChange={(e) => setD({ ...d, horas: Number(e.target.value) })} options={[24, 48, 72].map((h) => ({ value: h, label: `${h} horas` }))} /></Field>
        <Field label="Adelanto (opcional)"><Input type="number" placeholder="0" value={d.adelanto} onChange={(e) => setD({ ...d, adelanto: e.target.value })} /></Field>
        <Field label="Método del adelanto"><Select value={d.metodo} onChange={(e) => setD({ ...d, metodo: e.target.value })} options={db.config.metodos} /></Field>
      </div>
      <DeliveryFields db={db} d={d} setD={setD} actions={actions} />
      <Field label="Observaciones"><Input value={d.obs} onChange={(e) => setD({ ...d, obs: e.target.value })} /></Field>
      <Note>Al confirmar, el par se bloquea para el otro socio. Si alguien lo reservó o vendió un segundo antes, la reserva se rechaza.</Note>
    </Modal>
  );
}

/** Línea de un par dentro de una venta */
function ItemLinea({ p, precio, onPrecio, regalo, onQuitar = null, lista = null }) {
  return (
    <div className="flex items-center gap-3 p-2.5">
      <div className="w-12 h-10 rounded-md overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{p.codigo} · {p.marca} {p.modelo}</div>
        <div className="text-xs text-slate-500 truncate">Talla {p.talla} · lista {bs0(lista ?? p.precio)} · costo {bs(pCost(p))}</div>
      </div>
      {regalo
        ? <span className="w-24 text-right text-sm font-semibold text-amber-700 flex items-center justify-end gap-1"><Gift size={14} /> Bs 0</span>
        : <input className={inputCls + " w-24 text-right"} type="number" inputMode="decimal" min="0" value={precio} onChange={(e) => onPrecio(e.target.value)} aria-label={`Precio final de ${p.codigo}`} />}
      {onQuitar && <button className="p-1 text-slate-400 hover:text-rose-500" onClick={onQuitar} aria-label={`Quitar ${p.codigo}`}><X size={16} /></button>}
    </div>
  );
}

/** Interruptor para marcar la operación como regalo */
function RegaloSwitch({ value, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left border ${value ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
      <Gift size={20} className={value ? "text-amber-600" : "text-slate-400"} />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900">Es un regalo</span>
        <span className="block text-xs text-slate-500">Se cierra en Bs 0 y no queda saldo pendiente. Su valor se muestra aparte en el dashboard.</span>
      </span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${value ? "bg-amber-500" : "bg-slate-300"}`}><span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : ""}`} /></span>
    </button>
  );
}

export function SellModal({ db, init, onClose, actions }) {
  const [items, setItems] = useState((init.productIds || []).map((id) => ({ productId: id, precio: db.products.find((p) => p.id === id).precio })));
  const res = (init.reservaIds || []).map((r) => db.reservations.find((x) => x.id === r)).filter(Boolean);
  const adelanto = sum(res, (r) => r.adelanto);
  const [d, setD] = useState({ clienteId: init.clienteId || "", canal: res[0]?.canal || db.config.canales[0] || "", pago: "", metodo: "QR", obs: "", regalo: false, entregado: false, ...envioInicial(db), ...(res[0]?.envio || {}) });
  const [busy, run] = useBusy();
  const ps = items.map((i) => db.products.find((x) => x.id === i.productId)).filter(Boolean);
  const total = d.regalo ? 0 : sum(items, (i) => Number(i.precio) || 0);
  const pago = d.regalo ? 0 : Number(d.pago) || 0;
  const saldo = d.regalo ? 0 : total - adelanto - pago;
  const valorRegalo = sum(ps, (p) => p.precio), costoRegalo = sum(ps, pCost);
  const avail = db.products.filter((p) => p.estado === "Disponible" && !items.some((i) => i.productId === p.id));
  const tienda = (c) => /tienda/i.test(c);
  const setCanal = (c) => setD(tienda(c) ? { ...d, canal: c, entrega: "Recojo en punto", delivery: 0, pagaCliente: false, entregado: true } : { ...d, canal: c });
  const canales = [...new Set([...db.config.canales, d.canal].filter(Boolean))];
  const titulo = res.length ? `Convertir ${res[0].id} en ${d.regalo ? "regalo" : "venta"}` : d.regalo ? "Nuevo regalo" : "Nueva venta";
  return (
    <Modal wide title={titulo} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn variant={d.regalo ? "lila" : "primary"} disabled={busy || !items.length || !d.clienteId || saldo < 0} onClick={() => run(async () => { if (await actions.sell({ ...d, pago, items, reservaIds: init.reservaIds })) onClose(); })}>{busy ? <Spinner /> : d.regalo ? <Gift size={15} /> : null} {d.regalo ? "Registrar regalo" : "Registrar venta"}</Btn></>}>
      <Field label={d.regalo ? "¿Para quién es el regalo?" : "Comprador"}><ClientPicker db={db} value={d.clienteId} onChange={(v) => setD({ ...d, clienteId: v })} actions={actions} /></Field>
      <div>
        <div className="text-xs font-medium text-slate-600 mb-1">Pares {d.regalo ? "del regalo" : "de esta venta"}</div>
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {items.map((it, k) => { const p = ps.find((x) => x.id === it.productId); return p && (
            <ItemLinea key={it.productId} p={p} precio={it.precio} regalo={d.regalo}
              onPrecio={(v) => setItems(items.map((x, j) => (j === k ? { ...x, precio: v } : x)))}
              onQuitar={res.length ? null : () => setItems(items.filter((_, j) => j !== k))} />); })}
          <div className="p-2.5">
            <SearchBox
              items={avail} label="Agregar otro par"
              placeholder={items.length ? "Agregar otro par para este comprador: código, marca, talla…" : "Busca el par: código, marca, modelo o talla"}
              sinResultados="No hay pares disponibles que coincidan."
              getText={(p) => `${p.codigo} ${p.marca} ${p.modelo} talla ${p.talla} t${p.talla} ${p.color} ${p.cm || ""}`}
              onPick={(p) => setItems([...items, { productId: p.id, precio: p.precio }])}
              render={(p) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-8 rounded overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.codigo} · {p.marca} {p.modelo}</div><div className="text-xs text-slate-500 truncate">Talla {p.talla}{p.cm ? ` · ${String(p.cm).replace(".", ",")} cm` : ""} · {p.color}</div></div>
                  <span className="text-sm font-semibold vx-num shrink-0">{bs0(p.precio)}</span>
                </div>
              )}
            />
          </div>
        </div>
      </div>
      <RegaloSwitch value={d.regalo} onChange={(v) => setD({ ...d, regalo: v, pago: v ? "" : d.pago })} />
      <div className={`grid gap-3 ${d.regalo ? "" : "sm:grid-cols-3"}`}>
        <Field label="Canal o punto de venta"><Select value={d.canal} onChange={(e) => setCanal(e.target.value)} options={canales} /></Field>
        {!d.regalo && <Field label="Pago ahora"><Input type="number" inputMode="decimal" placeholder="0" value={d.pago} onChange={(e) => setD({ ...d, pago: e.target.value })} /></Field>}
        {!d.regalo && <Field label="Método"><Select value={d.metodo} onChange={(e) => setD({ ...d, metodo: e.target.value })} options={db.config.metodos} /></Field>}
      </div>
      <DeliveryFields db={db} d={d} setD={setD} actions={actions} entregadoOpcion />
      {d.regalo ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm space-y-1 vx-num">
          <div className="flex justify-between"><span>Valor del regalo (precio de lista)</span><span className="font-semibold">{bs(valorRegalo)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Lo que le cuesta al negocio</span><span>{bs(costoRegalo)}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t border-amber-200"><span>Se cobra</span><span>Bs 0,00 · sin saldo pendiente</span></div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1 vx-num">
          <div className="flex justify-between"><span>Total de la venta</span><span className="font-semibold">{bs(total)}</span></div>
          {adelanto > 0 && <div className="flex justify-between text-cyan-700"><span>Adelanto de la reserva (ya cobrado)</span><span>− {bs(adelanto)}</span></div>}
          <div className="flex justify-between text-cyan-700"><span>Pago ahora</span><span>− {bs(pago)}</span></div>
          <div className={`flex justify-between font-semibold pt-1 border-t border-slate-200 ${saldo < 0 ? "text-rose-600" : ""}`}><span>Saldo pendiente</span><span>{bs(saldo)}</span></div>
        </div>
      )}
      {adelanto > 0 && (d.regalo
        ? <Note tone="rose">La reserva tenía un adelanto de {bs(adelanto)}. Al registrarla como regalo, ese adelanto queda como devuelto al cliente.</Note>
        : <Note tone="teal">El adelanto pasa a esta venta. No se registra como un cobro nuevo, para no contarlo dos veces.</Note>)}
    </Modal>
  );
}

/** Modificar una venta ya registrada: regalo, precios, canal y estado de la entrega */
export function EditSaleModal({ db, ventaId, onClose, actions, client }) {
  const s = db.sales.find((x) => x.id === ventaId);
  const [busy, run] = useBusy();
  const [regalo, setRegalo] = useState(!!s?.regalo);
  const [precios, setPrecios] = useState(() => Object.fromEntries((s?.items || []).map((it) => [it.id, s.regalo ? itemLista(db, it) : it.precio])));
  const [canal, setCanal] = useState(s?.canal || "");
  const [pedido, setPedido] = useState(s?.pedido || ESTADOS_PEDIDO[0]);
  if (!s) return null;
  const items = s.items.filter((it) => it.activo !== false);
  const pagado = paidOf(db, s.id);
  const total = regalo ? 0 : sum(items, (it) => Number(precios[it.id]) || 0);
  const bajoCobrado = !regalo && total + 0.001 < pagado;
  const canales = [...new Set([...db.config.canales, s.canal].filter(Boolean))];
  const c = client(s.clienteId);
  const guardar = () => run(async () => {
    if (await actions.editSale(s.id, { regalo, precios: items.map((it) => ({ id: it.id, precio: precios[it.id] })), canal, pedido })) onClose();
  });
  return (
    <Modal wide title={`Modificar ${s.id}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || bajoCobrado} onClick={guardar}>{busy ? <Spinner /> : null} Guardar cambios</Btn></>}>
      <div className="text-sm text-slate-600">{c?.nombre} · {fdate(s.fecha)} · {s.canal}</div>
      <RegaloSwitch value={regalo} onChange={(v) => {
        setRegalo(v);
        if (!v && s.regalo) setPrecios(Object.fromEntries(items.map((it) => [it.id, itemLista(db, it)])));
      }} />
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
        {items.map((it) => { const p = db.products.find((x) => x.id === it.productId); return p && (
          <ItemLinea key={it.id} p={p} lista={itemLista(db, it)} precio={precios[it.id]} regalo={regalo} onPrecio={(v) => setPrecios({ ...precios, [it.id]: v })} />); })}
      </div>
      {regalo && pagado > 0 && <Note tone="rose">Esta venta tiene {bs(pagado)} cobrados. Al marcarla como regalo, esos pagos quedan como devueltos y dejan de contar como dinero cobrado.</Note>}
      {!regalo && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1 vx-num">
          <div className="flex justify-between"><span>Nuevo total</span><span className="font-semibold">{bs(total)}</span></div>
          <div className="flex justify-between text-cyan-700"><span>Ya cobrado</span><span>{bs(pagado)}</span></div>
          <div className={`flex justify-between font-semibold pt-1 border-t border-slate-200 ${bajoCobrado ? "text-rose-600" : ""}`}><span>Saldo pendiente</span><span>{bs(total - pagado)}</span></div>
          {bajoCobrado && <p className="text-xs text-rose-600">El total no puede quedar por debajo de lo ya cobrado. Sube el precio o márcala como regalo.</p>}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Canal o punto de venta"><Select value={canal} onChange={(e) => setCanal(e.target.value)} options={canales} /></Field>
        <Field label="Estado de la entrega"><Select value={pedido} onChange={(e) => setPedido(e.target.value)} options={ESTADOS_PEDIDO} /></Field>
      </div>
      {pedido !== "Entregado" && <Btn variant="outline" className="w-full" onClick={() => setPedido("Entregado")}><PackageCheck size={15} /> Marcar como ya entregado</Btn>}
      <p className="text-xs text-slate-500">Cada cambio queda anotado en Actividad con tu nombre.</p>
    </Modal>
  );
}

export function PayModal({ db, ventaId, onClose, actions }) {
  const s = db.sales.find((x) => x.id === ventaId);
  const saldo = saleTotal(s) - paidOf(db, ventaId);
  const [monto, setMonto] = useState(saldo);
  const [metodo, setMetodo] = useState(db.config.metodos.includes("QR") ? "QR" : db.config.metodos[0] || "Efectivo");
  const [busy, run] = useBusy();
  return (
    <Modal title={`Registrar pago · ${ventaId}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !(Number(monto) > 0)} onClick={() => run(async () => { if (await actions.pay(ventaId, Number(monto), metodo)) onClose(); })}>{busy ? <Spinner /> : null} Registrar pago</Btn></>}>
      <div className="grid grid-cols-3 gap-2 text-center text-sm vx-num">
        <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Total</div>{bs0(saleTotal(s))}</div>
        <div className="rounded-lg bg-cyan-50 p-2"><div className="text-xs text-cyan-700">Cobrado</div>{bs0(paidOf(db, ventaId))}</div>
        <div className="rounded-lg bg-rose-50 p-2"><div className="text-xs text-rose-700">Saldo</div>{bs0(saldo)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto" hint="No puede superar el saldo"><Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        <Field label="Método"><Select value={metodo} onChange={(e) => setMetodo(e.target.value)} options={db.config.metodos} /></Field>
      </div>
      <div>
        <div className="text-xs font-medium text-slate-600 mb-1">Pagos anteriores</div>
        {db.payments.filter((p) => p.ventaId === ventaId).map((p) => <div key={p.id} className="flex justify-between text-sm py-1 border-b border-slate-100"><span>{fdate(p.fecha)} · {p.metodo}</span><span className="vx-num">{bs(p.monto)}</span></div>)}
      </div>
    </Modal>
  );
}

export function VoidModal({ ventaId, onClose, actions }) {
  const [motivo, setMotivo] = useState("");
  const [busy, run] = useBusy();
  return (
    <Modal title={`Anular ${ventaId}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn variant="danger" disabled={busy || motivo.trim().length < 4} onClick={() => run(async () => { if (await actions.voidSale(ventaId, motivo.trim())) onClose(); })}>{busy ? <Spinner /> : null} Anular venta</Btn></>}>
      <p className="text-sm text-slate-600">La venta no se borra: queda marcada como anulada, los pares vuelven a disponible y los pagos quedan como reembolsados.</p>
      <Field label="Motivo (obligatorio)"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: el cliente devolvió el par" /></Field>
    </Modal>
  );
}

/** Enlace a WhatsApp con el número del cliente (Bolivia +591) */
export const waLink = (tel, texto = "") => {
  const d = String(tel || "").replace(/[^0-9]/g, "");
  const n = d.length === 8 ? "591" + d : d;
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};

export function Reservations({ db, actions, setModal, client, prod, userName, can }) {
  const [tab, setTab] = useState("Activa");
  const [soloWeb, setSoloWeb] = useState(false);
  const list = db.reservations.filter((r) => r.estado === tab && (!soloWeb || r.web)).sort((a, b) => (tab === "Activa" ? a.vence.localeCompare(b.vence) : b.creado.localeCompare(a.creado)));
  const webActivos = new Set(db.reservations.filter((r) => r.web && r.estado === "Activa").map((r) => r.pedidoWeb)).size;
  // Un pedido de la tienda puede traer varios pares: se convierten todos juntos
  const convertir = (r) => {
    const grupo = r.web && r.pedidoWeb ? db.reservations.filter((x) => x.pedidoWeb === r.pedidoWeb && x.estado === "Activa") : [r];
    setModal({ type: "sell", productIds: grupo.map((x) => x.productId), reservaIds: grupo.map((x) => x.id), clienteId: r.clienteId });
  };
  const cancelar = (r) => { if (confirm("¿Cancelar la reserva? El par vuelve a Disponibles.")) actions.cancelReservation(r.id); };
  const Etiqueta = ({ r }) => r.web ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 text-cyan-800 ring-1 ring-inset ring-cyan-200 px-2 py-0.5 text-xs font-semibold"><ShoppingBag size={11} /> Tienda · {r.tipoWeb === "Reserva" ? "reserva" : "compra"} · {r.pedidoWeb}</span>
  ) : null;
  // Estado del pago del pedido web según el último comprobante
  const compDe = (r) => r.web ? db.comprobantes.filter((c) => c.pedido === r.pedidoWeb).sort((a, b) => b.creado.localeCompare(a.creado))[0] : null;
  const PagoWeb = ({ r }) => {
    if (!r.web || r.estado !== "Activa") return null;
    const c = compDe(r);
    if (!c) return <span className="inline-flex rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs">Esperando comprobante</span>;
    if (c.estado === "En revisión") return <button onClick={() => setModal({ type: "revisarPago", comprobanteId: c.id })} className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 px-2 py-0.5 text-xs font-semibold">Comprobante en revisión · Revisar</button>;
    if (c.estado === "Rechazado") return <span className="inline-flex rounded-full bg-rose-50 text-rose-700 px-2 py-0.5 text-xs" title={c.motivo}>Comprobante rechazado</span>;
    return null;
  };
  const mensaje = (r) => {
    const c = client(r.clienteId);
    const pares = db.reservations.filter((x) => x.pedidoWeb === r.pedidoWeb && x.estado === "Activa").map((x) => { const p = prod(x.productId); return p ? `${p.codigo} ${p.marca} ${p.modelo} talla ${p.talla}` : ""; }).filter(Boolean);
    return `Hola ${c?.nombre?.split(" ")[0] || ""}, te escribimos de VORTEX SNEAKERS por tu pedido ${r.pedidoWeb}: ${pares.join(", ")}.`;
  };
  const Acciones = ({ r, movil = false }) => tab !== "Activa" ? null : (
    <div className={`flex gap-1.5 ${movil ? "mt-2 flex-wrap" : ""}`}>
      {r.web && compDe(r)?.estado === "En revisión" && <Btn size="sm" className={movil ? "flex-1" : ""} onClick={() => setModal({ type: "revisarPago", comprobanteId: compDe(r).id })}>Revisar pago</Btn>}
      {can?.sell !== false && !(r.web && compDe(r)?.estado === "En revisión") && <Btn size="sm" variant={r.web ? "outline" : "primary"} className={movil ? "flex-1" : ""} onClick={() => convertir(r)}>{r.web && db.reservations.filter((x) => x.pedidoWeb === r.pedidoWeb && x.estado === "Activa").length > 1 ? "Convertir pedido en venta" : "Convertir en venta"}</Btn>}
      {r.web && client(r.clienteId)?.telefono && <a className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50" href={waLink(client(r.clienteId).telefono, mensaje(r))} target="_blank" rel="noreferrer"><Phone size={13} /> WhatsApp</a>}
      <Btn size="sm" variant="danger" onClick={() => cancelar(r)}>Cancelar</Btn>
    </div>
  );
  return (
    <div>
      <PageHead title="Reservas" route="/reservas" desc="Una reserva bloquea el par hasta que vence, se cancela o se convierte en venta. Los pedidos de la tienda en línea también llegan aquí." />
      <ComprobantesPendientes db={db} client={client} setModal={setModal} />
      {webActivos > 0 && <div className="mb-3"><Note tone="teal">Tienes {webActivos} pedido{webActivos === 1 ? "" : "s"} de la tienda en línea esperando pago. El cliente paga con el QR y sube su comprobante; cuando llegue, tócalo para revisarlo y aprobarlo.</Note></div>}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit max-w-full overflow-x-auto vx-noscroll">
          {[["Activa", "Activas"], ["Convertida", "Convertidas en venta"], ["Cancelada", "Canceladas"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${tab === k ? "bg-purple-600 text-white" : "text-slate-600"}`}>{l} ({db.reservations.filter((r) => r.estado === k && (!soloWeb || r.web)).length})</button>)}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-purple-700" checked={soloWeb} onChange={(e) => setSoloWeb(e.target.checked)} /> Solo tienda en línea
        </label>
      </div>
      <Panel>
        <Table head={["Reserva", "Par", "Cliente", "Origen", "Entrega", "Adelanto", tab === "Activa" ? "Vence en" : "Fecha", ""]} empty={!list.length && "No hay reservas en esta lista."} mobile={list.map((r) => { const p = prod(r.productId), c = client(r.clienteId); const h = (new Date(r.vence) - NOW) / 3600000; return p && (
          <MRow key={r.id}>
            <div className="flex gap-3">
              <div className="w-14 h-11 rounded-md overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2"><span className="text-sm font-semibold truncate">{p.codigo} · {p.marca} {p.modelo}</span><span className="text-xs text-slate-500 shrink-0">{r.id}</span></div>
                <div className="text-xs text-slate-600">{c?.nombre} · {c?.telefono}</div>
                {r.web && <div className="mt-1 flex flex-wrap gap-1"><Etiqueta r={r} /><PagoWeb r={r} /></div>}
                {r.web && <div className="text-xs text-slate-600 mt-1 flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" />{entregaWeb(r.envio)}</div>}
                {r.web && r.obs && tab === "Activa" && <div className="text-xs text-slate-500 italic mt-0.5">“{r.obs}”</div>}
                <div className="text-xs mt-0.5">{tab === "Activa" ? <span className={h < 12 ? "text-rose-600 font-medium" : "text-slate-500"}>Vence en {h > 0 ? `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min` : "0 h"}</span> : <span className="text-slate-500">{fdate(r.creado)} {tab === "Cancelada" ? `· ${r.obs}` : `· ${r.ventaId || ""}`}</span>}{r.adelanto ? <span className="text-slate-500"> · adelanto {bs0(r.adelanto)}</span> : null}</div>
              </div>
            </div>
            <Acciones r={r} movil />
          </MRow>); })}>
          {list.map((r) => { const p = prod(r.productId), c = client(r.clienteId); const h = (new Date(r.vence) - NOW) / 3600000; return p && (
            <tr key={r.id} className={r.web && tab === "Activa" ? "bg-cyan-50/40" : ""}>
              <Td className="font-medium">{r.id}</Td><Td><span className="vx-d font-semibold">{p.codigo}</span> <span className="text-slate-500">{p.marca} {p.modelo} T{p.talla}</span></Td>
              <Td>{c?.nombre}<div className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} />{c?.telefono}</div></Td>
              <Td>{r.web ? <div className="flex flex-col items-start gap-1"><Etiqueta r={r} /><PagoWeb r={r} /></div> : <span>{userName(r.socio)}<div className="text-xs text-slate-500">{r.canal}</div></span>}</Td>
              <Td className="max-w-xs whitespace-normal text-xs text-slate-600">{r.web ? <>{entregaWeb(r.envio)}{r.obs && tab === "Activa" ? <div className="italic text-slate-500">“{r.obs}”</div> : null}</> : (r.envio?.entrega || "—")}</Td>
              <Td className="vx-num">{r.adelanto ? bs(r.adelanto) : "—"}</Td>
              <Td>{tab === "Activa" ? <span className={`vx-num ${h < 12 ? "text-rose-600 font-medium" : ""}`}>{h > 0 ? `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min` : "Vencida"}</span> : fdate(r.creado)}</Td>
              <Td><Acciones r={r} />{tab === "Convertida" && <span className="text-xs text-slate-500">{r.ventaId}</span>}{tab === "Cancelada" && <span className="text-xs text-slate-500">{r.obs}</span>}</Td>
            </tr>); })}
        </Table>
      </Panel>
    </div>
  );
}

export function Sales({ db, m, setModal, client, userName, can }) {
  const [f, setF] = useState("Todas");
  const [q, setQ] = useState("");
  const list = [...db.sales].reverse().filter((s) => (f === "Todas" || payState(db, s) === f) && norm(`${s.id} ${client(s.clienteId)?.nombre} ${client(s.clienteId)?.telefono} ${s.canal}`).includes(norm(q)));
  return (
    <div>
      <PageHead title="Ventas" route="/ventas" desc="Una venta se registra una vez; los pagos se suman a ella hasta saldarla.">
        <Btn onClick={() => setModal({ type: "sell", productIds: [] })}><Plus size={15} /> Nueva venta</Btn>
      </PageHead>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <Stat label="Ventas registradas" value={bs0(m.ventas)} tone="slate" />
        <Stat label="Cobrado de ventas" value={bs0(m.cobradoVentas)} tone="teal" />
        <Stat label="Saldo por cobrar" value={bs0(m.pendiente)} tone="rose" />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className={inputCls + " pl-9"} placeholder="Buscar por número, cliente, teléfono o canal" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 overflow-x-auto">{["Todas", "Pendiente", "Parcial", "Pagado", "Regalo", "Reembolsado"].map((k) => <button key={k} onClick={() => setF(k)} className={`px-3 py-1 text-sm rounded-md whitespace-nowrap ${f === k ? "bg-slate-900 text-white" : "text-slate-600"}`}>{k}</button>)}</div>
      </div>
      <Panel>
        <Table head={["Venta", "Fecha", "Cliente", "Pares", "Total", "Cobrado", "Saldo", "Pago", "Canal", "Socio", ""]} empty={!list.length && "No hay ventas con este filtro."} mobile={list.map((s) => { const t = saleTotal(s), pd = paidOf(db, s.id), st = payState(db, s); return (
          <MRow key={s.id}>
            <div className={s.estado === "Anulada" ? "opacity-50" : ""}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{s.id} <span className="font-normal text-slate-500">· {fdate(s.fecha)}</span></span><Pill>{st}</Pill></div>
              <div className="flex items-end justify-between gap-2 mt-1">
                <div className="min-w-0"><div className="text-sm truncate">{client(s.clienteId)?.nombre}</div><div className="text-xs text-slate-500 truncate">{s.items.map((i) => db.products.find((p) => p.id === i.productId)?.codigo).join(", ")} · {s.canal}</div></div>
                <div className="text-right vx-num shrink-0"><div className="text-sm font-semibold">{bs0(t)}</div>{s.estado === "Activa" && t - pd > 0 && <div className="text-xs text-rose-600">Saldo {bs0(t - pd)}</div>}</div>
              </div>
              {s.estado === "Activa" && <div className="flex gap-2 mt-2">{t - pd > 0 && <Btn size="sm" className="flex-1" onClick={() => setModal({ type: "pay", ventaId: s.id })}>Registrar pago</Btn>}{can.admin && <Btn size="sm" variant="outline" onClick={() => setModal({ type: "editSale", ventaId: s.id })}><Pencil size={13} /> Modificar</Btn>}{can.admin && <Btn size="sm" variant="outline" onClick={() => setModal({ type: "void", ventaId: s.id })}>Anular</Btn>}</div>}
            </div>
          </MRow>); })}>
          {list.map((s) => { const t = saleTotal(s), pd = paidOf(db, s.id), st = payState(db, s); return (
            <tr key={s.id} className={s.estado === "Anulada" ? "opacity-50" : ""}>
              <Td className="font-medium">{s.id}</Td><Td>{fdate(s.fecha)}</Td><Td>{client(s.clienteId)?.nombre}</Td>
              <Td>{s.items.map((i) => db.products.find((p) => p.id === i.productId)?.codigo).join(", ")}</Td>
              <Td className="vx-num font-medium">{bs(t)}</Td><Td className="vx-num text-cyan-700">{bs(s.estado === "Anulada" ? 0 : pd)}</Td><Td className="vx-num text-rose-600">{s.estado === "Anulada" ? "—" : bs(t - pd)}</Td>
              <Td><Pill>{st}</Pill></Td><Td>{s.canal}</Td><Td>{userName(s.socio)}</Td>
              <Td>{s.estado === "Activa" && <div className="flex gap-1.5">{t - pd > 0 && <Btn size="sm" onClick={() => setModal({ type: "pay", ventaId: s.id })}>Registrar pago</Btn>}{can.admin && <Btn size="sm" variant="outline" onClick={() => setModal({ type: "editSale", ventaId: s.id })}><Pencil size={13} /> Modificar</Btn>}{can.admin && <Btn size="sm" variant="ghost" onClick={() => setModal({ type: "void", ventaId: s.id })}>Anular</Btn>}</div>}</Td>
            </tr>); })}
        </Table>
      </Panel>
    </div>
  );
}

export function Orders({ db, actions, client, setModal }) {
  const active = db.sales.filter((s) => s.estado === "Activa");
  const [mob, setMob] = useState(ESTADOS_PEDIDO[0]);
  const card = (s, idx) => { const c = client(s.clienteId), saldo = saleTotal(s) - paidOf(db, s.id); return (
    <div key={s.id} className="bg-white rounded-lg border border-slate-200 hover:border-cyan-400 transition-colors">
      <button className="w-full text-left p-3" onClick={() => setModal({ type: "order", ventaId: s.id })} aria-label={`Ver detalle del pedido ${s.id}`}>
        <div className="flex justify-between items-start"><span className="text-sm font-semibold">{s.id}</span>{saldo > 0 ? <Pill tone="Pendiente">Saldo {bs0(saldo)}</Pill> : <Pill tone="Pagado">Pagado</Pill>}</div>
        <div className="text-sm mt-1">{c?.nombre}</div>
        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={11} />{s.entrega.tipo}{s.entrega.destino ? ` a ${s.entrega.destino}` : ` · ${c?.zona}`}</div>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {s.items.map((i) => { const p = db.products.find((x) => x.id === i.productId); if (!p) return null; return <span key={i.productId} className="flex items-center gap-1 bg-slate-50 rounded-md pr-1.5 text-xs font-semibold"><span className="w-8 h-6 rounded overflow-hidden vx-photo inline-block"><ProductPhoto p={p} /></span>{p.codigo}</span>; })}
        </div>
        <div className="text-xs text-slate-500 mt-1.5">{s.entrega.tipo === "Recojo en punto" ? "Recojo" : "Envío"} {fdate(s.entrega.fechaEstimada)}</div>
      </button>
      {idx < ESTADOS_PEDIDO.length - 1 && <div className="px-3 pb-3"><Btn size="sm" variant="outline" className="w-full" onClick={() => actions.advanceOrder(s.id)}>Pasar a {ESTADOS_PEDIDO[idx + 1].toLowerCase()}</Btn></div>}
    </div>); };
  return (
    <div>
      <PageHead title="Pedidos y entregas" route="/pedidos" desc="Cada venta genera un pedido. Toca un pedido para ver cada par, la entrega y los pagos." />
      {/* Celular: una etapa a la vez */}
      <div className="sm:hidden">
        <div className="flex gap-1.5 overflow-x-auto vx-noscroll pb-2 mb-2 -mx-3 px-3">
          {ESTADOS_PEDIDO.map((st) => { const n = active.filter((s) => s.pedido === st).length; return (
            <button key={st} onClick={() => setMob(st)} aria-pressed={mob === st} className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${mob === st ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>{st}<span className={`text-xs rounded-full px-1.5 ${mob === st ? "bg-white text-slate-900" : "bg-slate-100"}`}>{n}</span></button>); })}
        </div>
        <div className="space-y-2">
          {active.filter((s) => s.pedido === mob).map((s) => card(s, ESTADOS_PEDIDO.indexOf(mob)))}
          {!active.some((s) => s.pedido === mob) && <p className="text-sm text-slate-400 text-center py-10">Sin pedidos en esta etapa.</p>}
        </div>
      </div>
      {/* Computadora y tablet: tablero por columnas */}
      <div className="hidden sm:flex gap-3 overflow-x-auto pb-3">
        {ESTADOS_PEDIDO.map((st, idx) => { const list = active.filter((s) => s.pedido === st); return (
          <div key={st} className="w-72 shrink-0 bg-slate-100 rounded-xl p-2.5">
            <div className="flex items-center justify-between px-1 mb-2"><span className="text-sm font-semibold text-slate-700">{st}</span><span className="text-xs bg-white rounded-full px-2 py-0.5 text-slate-600">{list.length}</span></div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {list.map((s) => card(s, idx))}
              {!list.length && <p className="text-xs text-slate-400 text-center py-6">Sin pedidos</p>}
            </div>
          </div>); })}
      </div>
    </div>
  );
}

export function OrderDetail({ db, ventaId, onClose, actions, client, userName, setDrawer, setModal, can }) {
  const s = db.sales.find((x) => x.id === ventaId);
  if (!s) return null;
  const c = client(s.clienteId);
  const [open, setOpen] = useState(s.items[0]?.productId);
  const total = saleTotal(s), pd = paidOf(db, s.id), saldo = total - pd;
  const idx = ESTADOS_PEDIDO.indexOf(s.pedido);
  const e = s.entrega;
  return (
    <Modal wide title={`Pedido ${s.id}`} onClose={onClose} footer={<>
      {can.admin && s.estado === "Activa" && <Btn variant="outline" onClick={() => setModal({ type: "editSale", ventaId })}><Pencil size={15} /> Modificar</Btn>}
      {saldo > 0 && can.sell && <Btn variant="outline" onClick={() => setModal({ type: "pay", ventaId })}><CreditCard size={15} /> Registrar pago</Btn>}
      {idx < ESTADOS_PEDIDO.length - 1 ? <Btn onClick={() => actions.advanceOrder(s.id)}>Pasar a {ESTADOS_PEDIDO[idx + 1].toLowerCase()}</Btn> : <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}
    </>}>
      <ol className="flex items-start" aria-label="Avance del pedido">
        {ESTADOS_PEDIDO.map((st, i) => (
          <li key={st} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 && <span className={`absolute top-3 right-1/2 w-full h-0.5 ${i <= idx ? "bg-cyan-500" : "bg-slate-200"}`} />}
            <span className={`relative z-10 w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${i < idx ? "bg-cyan-500 text-white" : i === idx ? "bg-purple-700 text-white" : "bg-slate-200 text-slate-500"}`}>{i < idx ? "✓" : i + 1}</span>
            <span className={`text-xs mt-1 leading-tight ${i === idx ? "font-semibold text-slate-900" : "text-slate-500"}`}>{st}</span>
          </li>
        ))}
      </ol>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500 mb-1">Cliente</div>
          <div className="font-semibold">{c?.nombre}</div>
          <div className="text-slate-600 flex items-center gap-1 mt-1"><Phone size={13} />{c?.telefono}</div>
          <div className="text-slate-600 flex items-center gap-1"><MapPin size={13} />{e.direccion || c?.direccion}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500 mb-1">Entrega</div>
          <div className="font-semibold">{e.tipo}{e.destino ? ` a ${e.destino}` : ""}</div>
          <div className="text-slate-600 mt-1">{e.tipo === "Recojo en punto" ? "Recojo" : "Envío"}: {fdate(e.fechaEstimada)}</div>
          {e.tipo !== "Recojo en punto" && <div className="text-slate-600">Costo {bs(e.costo)} · paga {e.pagaCliente ? "el cliente" : "el negocio"}</div>}
          {e.transportista && <div className="text-slate-600">Empresa: {e.transportista}</div>}
          {e.recibe && <div className="text-slate-600">Recoge: {e.recibe}</div>}
          {e.guia && <div className="text-slate-600">Guía: <b>{e.guia}</b></div>}
          {s.estado === "Activa" && s.pedido !== "Entregado" && e.tipo !== "Recojo en punto" && <ProgramarEnvio s={s} actions={actions} />}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-700 mb-1.5">Pares del pedido ({s.items.length})</div>
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
          {s.items.map((it) => { const p = db.products.find((x) => x.id === it.productId); if (!p) return null; const lot = db.lots.find((l) => l.id === p.lote) || { id: p.lote, nombre: "" }; const isOpen = open === p.id; return (
            <div key={p.id}>
              <button className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-slate-50" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                <div className="w-14 h-11 rounded-md overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{p.codigo} · {p.marca} {p.modelo}</div><div className="text-xs text-slate-500">Talla {p.talla} · {p.color} · {p.origen}</div></div>
                <span className="vx-num text-sm font-semibold">{bs0(it.precio)}</span>
                <ChevronRight size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 grid sm:grid-cols-3 gap-3">
                  <div className="vx-photo rounded-xl overflow-hidden aspect-video"><ProductPhoto p={p} /></div>
                  <dl className="sm:col-span-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    {[["Categoría", p.categoria], ["Estado físico", p.estadoFisico], ["Lote", `${lot.id} · ${lot.nombre}`], ["Fotos", `${p.fotos} cargadas`], ["Precio vendido", bs(it.precio)], ["Costo del par", bs(it.costo)]].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium vx-num">{v}</dd></div>)}
                    <div className="col-span-2 rounded-lg bg-cyan-50 px-2.5 py-1.5 flex justify-between text-cyan-800 font-semibold"><span>Utilidad del par</span><span className="vx-num">{bs(it.precio - it.costo)}</span></div>
                    <div className="col-span-2 text-xs text-slate-500">{p.descripcion}</div>
                    <div className="col-span-2"><Btn size="sm" variant="outline" onClick={() => { onClose(); setDrawer(p.id); }}>Abrir ficha completa del par</Btn></div>
                  </dl>
                </div>
              )}
            </div>); })}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1">Pagos</div>
          {db.payments.filter((x) => x.ventaId === s.id).map((x) => <div key={x.id} className="flex justify-between py-1 border-b border-slate-100"><span>{fdate(x.fecha)} · {x.metodo} · {userName(x.socio)}</span><span className="vx-num">{bs(x.monto)}</span></div>)}
          {!db.payments.some((x) => x.ventaId === s.id) && <p className="text-xs text-slate-400">Sin pagos todavía.</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-3 vx-num space-y-1">
          {s.regalo && <div className="flex justify-between text-amber-700 font-semibold"><span className="flex items-center gap-1"><Gift size={14} /> Regalo · valor</span><span>{bs(sum(s.items, (it) => itemLista(db, it)))}</span></div>}
          <div className="flex justify-between"><span>Total</span><span className="font-semibold">{bs(total)}</span></div>
          <div className="flex justify-between text-cyan-700"><span>Cobrado</span><span>{bs(pd)}</span></div>
          <div className={`flex justify-between font-semibold ${saldo > 0 ? "text-rose-600" : "text-cyan-700"}`}><span>Saldo</span><span>{bs(saldo)}</span></div>
          <div className="text-xs text-slate-500 pt-1">Venta del {fdate(s.fecha)} · {s.canal} · {userName(s.socio)}</div>
        </div>
      </div>
    </Modal>
  );
}

// Fecha de envío y n.º de guía (el cliente de la tienda los ve en "Mis pedidos")
function ProgramarEnvio({ s, actions }) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(s.entrega.fechaEstimada || "");
  const [guia, setGuia] = useState(s.entrega.guia || "");
  const [busy, run] = useBusy();
  if (!abierto) return <button className="mt-1.5 text-xs font-semibold text-purple-700" onClick={() => setAbierto(true)}>Cambiar fecha de envío o guía</button>;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha de envío" />
      <Input value={guia} maxLength={80} placeholder="N.º de guía" onChange={(e) => setGuia(e.target.value)} aria-label="Número de guía" />
      <div className="col-span-2 flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Btn><Btn size="sm" disabled={busy} onClick={() => run(async () => { if (await actions.programarEnvio(s.id, fecha, guia)) setAbierto(false); })}>Guardar</Btn></div>
    </div>
  );
}
