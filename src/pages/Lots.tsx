import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function Lots({ db, setModal, userName, can }) {
  return (
    <div>
      <PageHead title="Compras y lotes" route="/compras" desc="Cada fardo define el costo real de sus pares. Ese costo queda fijo en cada producto.">
        {can.inv && <Btn onClick={() => setModal({ type: "lot" })}><Plus size={15} /> Nuevo lote</Btn>}
      </PageHead>
      {!db.lots.length && <div className="bg-white rounded-xl border border-dashed border-slate-300 py-14 text-center text-sm text-slate-500">Todavía no hay lotes. Registra tu primera compra con “Nuevo lote”.</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {db.lots.map((l) => {
          const ps = db.products.filter((p) => p.lote === l.id), sold = ps.filter((p) => p.estado === "Vendido");
          const ventas = sum(db.sales.filter((s) => s.estado === "Activa").flatMap((s) => s.items).filter((i) => ps.some((p) => p.id === i.productId)), (i) => i.precio);
          return (
            <Panel key={l.id} title={`${l.id} · ${l.nombre}`} sub={`${db.providers.find((x) => x.id === l.proveedorId)?.nombre} (${db.providers.find((x) => x.id === l.proveedorId)?.telefono}) · ${fdate(l.fecha)} · registró ${userName(l.socio)}`} action={<div className="flex items-center gap-1.5"><Pill tone="Americano">{l.origen.split(" (")[0]}</Pill>{can.inv && <button className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" aria-label={`Editar ${l.id}`} onClick={() => setModal({ type: "lot", edit: l })}><Pencil size={14} /></button>}</div>}>
              <div className="grid grid-cols-3 gap-2 text-sm vx-num">
                {[["Compra", bs0(l.compra)], ["Transporte", bs0(l.transporte)], ["Otros", bs0(l.otros)], ["Inversión total", bs0(lotTotal(l))], ["Costo por par", bs(lotTotal(l) / l.pares)], ["Ventas del lote", bs0(ventas)]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-2"><div className="text-xs text-slate-500">{k}</div><div className="font-semibold">{v}</div></div>)}
              </div>
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div><div className="flex justify-between"><span>Pares cargados al inventario</span><span className="vx-num">{ps.length}/{l.pares}</span></div><div className="h-1.5 rounded-full bg-slate-100 mt-1"><div className="h-full rounded-full bg-purple-400" style={{ width: (ps.length / l.pares) * 100 + "%" }} /></div></div>
                <div><div className="flex justify-between"><span>Vendidos</span><span className="vx-num">{sold.length}/{ps.length || l.pares}</span></div><div className="h-1.5 rounded-full bg-slate-100 mt-1"><div className="h-full rounded-full bg-cyan-500" style={{ width: (sold.length / (ps.length || l.pares)) * 100 + "%" }} /></div></div>
                <div><div className="flex justify-between"><span>Recuperación del lote (ventas ÷ inversión)</span><span className="vx-num">{Math.round((ventas / lotTotal(l)) * 100)}%</span></div></div>
              </div>
              {l.obs && <p className="text-xs text-slate-500 mt-3">{l.obs}</p>}
            </Panel>
          );
        })}
      </div>
      <Panel className="mt-4" title="Proveedores" sub="Se agregan al registrar un lote con un proveedor nuevo">
        <Table head={["Proveedor", "Número", "Lotes", "Pares comprados", "Inversión", "Desde", ""]}>
          {db.providers.map((pv) => { const ls = db.lots.filter((l) => l.proveedorId === pv.id); return (
            <tr key={pv.id}><Td className="font-medium"><span className="inline-flex items-center gap-1.5"><Building2 size={14} className="text-slate-400" />{pv.nombre}</span></Td><Td><span className="inline-flex items-center gap-1"><Phone size={13} className="text-slate-400" />{pv.telefono || "—"}</span></Td><Td className="vx-num">{ls.length}</Td><Td className="vx-num">{sum(ls, (l) => l.pares)}</Td><Td className="vx-num">{bs0(sum(ls, lotTotal))}</Td><Td>{fdate(pv.desde)}</Td><Td>{can.inv && <button className="p-1 rounded text-slate-500 hover:bg-slate-100" aria-label="Editar proveedor" onClick={() => setModal({ type: "provider", edit: pv })}><Pencil size={14} /></button>}</Td></tr>); })}
        </Table>
      </Panel>
    </div>
  );
}

export function LotModal({ db, onClose, actions, edit = null }) {
  const [l, setL] = useState(edit
    ? { nombre: edit.nombre, fecha: edit.fecha, origen: edit.origen, pares: edit.pares, compra: edit.compra, transporte: edit.transporte, otros: edit.otros, obs: edit.obs }
    : { nombre: `Fardo ${db.lots.length + 1}`, fecha: TODAY, origen: "Mixto", pares: 40, compra: "", transporte: "", otros: 0, obs: "" });
  const hasProv = db.providers.length > 0;
  const [modo, setModo] = useState(hasProv ? "existente" : "nuevo");
  const first = (edit && db.providers.find((x) => x.id === edit.proveedorId)) || db.providers[db.providers.length - 1];
  const [prov, setProv] = useState({ id: first?.id || "", telefono: first?.telefono || "" });
  const [nuevo, setNuevo] = useState({ nombre: "", telefono: "" });
  const [busy, run] = useBusy();
  const dupTel = nuevo.telefono.trim().length >= 7 && db.providers.find((x) => x.telefono === nuevo.telefono.trim());
  const dupName = nuevo.nombre.trim() && db.providers.find((x) => x.nombre.toLowerCase() === nuevo.nombre.trim().toLowerCase());
  const provOk = modo === "existente" ? !!prov.id : nuevo.nombre.trim() && !dupTel && !dupName;
  const total = (Number(l.compra) || 0) + (Number(l.transporte) || 0) + (Number(l.otros) || 0);
  const registrados = edit ? db.products.filter((p) => p.lote === edit.id).length : 0;
  const vendidos = edit ? db.products.filter((p) => p.lote === edit.id && p.estado === "Vendido").length : 0;
  const usarExistente = (pv) => { setModo("existente"); setProv({ id: pv.id, telefono: pv.telefono }); };
  const origenes = [...new Set(["Mixto", "Americano", "Coreano", "Mayoría americano", "Mayoría coreano", l.origen].filter(Boolean))];
  const guardar = () => run(async () => {
    if (await actions.saveLot(l, modo === "existente" ? prov : { id: "", ...nuevo }, edit?.id || null)) onClose();
  });
  return (
    <Modal title={edit ? `Editar ${edit.id} · ${edit.nombre}` : "Nuevo lote o compra"} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || l.compra === "" || !(Number(l.pares) > 0) || !provOk} onClick={guardar}>{busy ? <Spinner /> : null} Guardar lote</Btn></>}>
      <div className="rounded-xl border border-slate-200 p-3 space-y-3">
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Building2 size={14} /> Proveedor</div>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-lg p-1" role="radiogroup" aria-label="Tipo de proveedor">
          {[["existente", "Ya trabajé con él"], ["nuevo", "Proveedor nuevo"]].map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={modo === k} disabled={k === "existente" && !hasProv} onClick={() => setModo(k)} className={`text-sm py-1.5 rounded-md disabled:opacity-40 ${modo === k ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500"}`}>{t}</button>)}
        </div>
        {modo === "existente" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proveedor"><Select value={prov.id} onChange={(e) => { const pv = db.providers.find((x) => x.id === e.target.value); setProv({ id: pv.id, telefono: pv.telefono }); }} options={db.providers.map((x) => ({ value: x.id, label: x.nombre }))} /></Field>
            <Field label="Número de teléfono" hint={`${db.lots.filter((x) => x.proveedorId === prov.id).length} lotes registrados`}><Input type="tel" inputMode="tel" value={prov.telefono} onChange={(e) => setProv({ ...prov, telefono: e.target.value })} /></Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del proveedor"><Input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} /></Field>
            <Field label="Número de teléfono"><Input type="tel" inputMode="tel" placeholder="7xxxxxxx" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} /></Field>
            {(dupTel || dupName) && <p className="col-span-2 text-xs text-rose-600">Ese {dupTel ? "número" : "nombre"} ya está registrado como {(dupTel || dupName).nombre}. <button className="underline" onClick={() => usarExistente(dupTel || dupName)}>Usar ese proveedor</button></p>}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre del lote"><Input value={l.nombre} onChange={(e) => setL({ ...l, nombre: e.target.value })} /></Field>
        <Field label="Fecha de compra"><Input type="date" value={l.fecha} onChange={(e) => setL({ ...l, fecha: e.target.value })} /></Field>
        <Field label="Origen"><Select value={l.origen} onChange={(e) => setL({ ...l, origen: e.target.value })} options={origenes} /></Field>
        <Field label="Cantidad de pares" hint={edit ? `${registrados} ya cargados` : null}><Input type="number" inputMode="numeric" value={l.pares} onChange={(e) => setL({ ...l, pares: e.target.value })} /></Field>
        <Field label="Costo de compra (Bs)"><Input type="number" inputMode="decimal" value={l.compra} onChange={(e) => setL({ ...l, compra: e.target.value })} /></Field>
        <Field label="Transporte (Bs)"><Input type="number" inputMode="decimal" value={l.transporte} onChange={(e) => setL({ ...l, transporte: e.target.value })} /></Field>
        <Field label="Otros gastos del lote (Bs)"><Input type="number" inputMode="decimal" value={l.otros} onChange={(e) => setL({ ...l, otros: e.target.value })} /></Field>
        <Field label="Observaciones"><Input value={l.obs} onChange={(e) => setL({ ...l, obs: e.target.value })} /></Field>
      </div>
      <div className="rounded-xl bg-cyan-50 p-3 text-sm vx-num">
        <div className="flex justify-between"><span>Inversión total del lote</span><span className="font-semibold">{bs(total)}</span></div>
        <div className="flex justify-between text-cyan-800"><span>Costo por par (repartido en partes iguales)</span><span className="font-semibold">{bs(Number(l.pares) > 0 ? total / Number(l.pares) : 0)}</span></div>
      </div>
      <p className="text-xs text-slate-500">
        El transporte y los otros gastos se reparten por igual entre los pares. El lote es inversión: no se cuenta como gasto operativo.
        {edit && vendidos > 0 ? ` Si cambias los montos, se recalcula el costo de los pares no vendidos; los ${vendidos} vendidos conservan su costo.` : ""}
      </p>
    </Modal>
  );
}

export function ProviderModal({ edit, onClose, actions, db }) {
  const [v, setV] = useState({ nombre: edit.nombre, telefono: edit.telefono });
  const [busy, run] = useBusy();
  const dup = db.providers.find((x) => x.id !== edit.id && (x.nombre.toLowerCase() === v.nombre.trim().toLowerCase() || (v.telefono.trim() && x.telefono === v.telefono.trim())));
  return (
    <Modal title="Editar proveedor" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !v.nombre.trim() || !!dup} onClick={() => run(async () => { if (await actions.updateProvider(edit.id, v.nombre, v.telefono)) onClose(); })}>{busy ? <Spinner /> : null} Guardar</Btn></>}>
      <Field label="Nombre"><Input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} /></Field>
      <Field label="Número de teléfono"><Input type="tel" inputMode="tel" value={v.telefono} onChange={(e) => setV({ ...v, telefono: e.target.value })} /></Field>
      {dup && <p className="text-xs text-rose-600">Ese nombre o número ya pertenece a {dup.nombre}.</p>}
    </Modal>
  );
}
