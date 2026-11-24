import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function Clients({ db, setModal, can }) {
  const [q, setQ] = useState("");
  const stats = (id) => { const s = db.sales.filter((x) => x.clienteId === id && x.estado === "Activa"); return { n: s.length, total: sum(s, saleTotal), last: s.map((x) => x.fecha).sort().slice(-1)[0] }; };
  const list = db.clients.filter((c) => `${c.nombre} ${c.telefono}`.toLowerCase().includes(q.toLowerCase())).map((c) => ({ ...c, ...stats(c.id) })).sort((a, b) => b.total - a.total);
  return (
    <div>
      <PageHead title="Clientes" route="/clientes" desc="El teléfono identifica al cliente: no se permiten dos clientes con el mismo número.">
        {can.sell && <Btn onClick={() => setModal({ type: "client" })}><UserPlus size={15} /> Nuevo cliente</Btn>}
      </PageHead>
      <div className="relative mb-3"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className={inputCls + " pl-9"} placeholder="Buscar por nombre o teléfono" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Panel>
        <Table head={["Cliente", "Teléfono", "Zona", "Pedidos", "Total comprado", "Última compra", ""]} empty={!list.length && "No se encontró ningún cliente."} mobile={list.map((c) => (
          <MRow key={c.id} onClick={() => setModal({ type: "clientDetail", id: c.id })}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full vx-grad text-white grid place-items-center text-xs font-bold shrink-0">{c.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("")}</div>
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{c.nombre}{c.n >= 3 && <span className="ml-1.5"><Pill tone="Activa">Frecuente</Pill></span>}{c.cuentaWeb && <span className="ml-1.5"><Pill tone="Disponible">Cuenta en la tienda</Pill></span>}</div><div className="text-xs text-slate-500">{c.telefono} · {c.zona}</div></div>
              <div className="text-right vx-num shrink-0"><div className="text-sm font-semibold">{bs0(c.total)}</div><div className="text-xs text-slate-500">{c.n} pedido{c.n === 1 ? "" : "s"}</div></div>
            </div>
          </MRow>
        ))}>
          {list.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <Td className="font-medium">{c.nombre}{c.n >= 3 && <span className="ml-2"><Pill tone="Activa">Frecuente</Pill></span>}{c.cuentaWeb && <span className="ml-2"><Pill tone="Disponible">Cuenta en la tienda</Pill></span>}</Td><Td>{c.telefono}</Td><Td>{c.zona}</Td>
              <Td className="vx-num">{c.n}</Td><Td className="vx-num font-medium">{bs(c.total)}</Td><Td>{fdate(c.last)}</Td>
              <Td><Btn size="sm" variant="ghost" onClick={() => setModal({ type: "clientDetail", id: c.id })}>Ver historial</Btn></Td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

export function ClientModal({ db, onClose, actions, edit = null }) {
  const [c, setC] = useState(edit ? { nombre: edit.nombre, telefono: edit.telefono, zona: edit.zona || "Cercado", direccion: edit.direccion, obs: edit.obs || "" } : { nombre: "", telefono: "", zona: "Cercado", direccion: "", obs: "" });
  const [busy, run] = useBusy();
  const tel = c.telefono.replace(/\s+/g, "");
  const dup = tel.length >= 7 && db.clients.find((x) => x.telefono === tel && x.id !== edit?.id);
  return (
    <Modal title={edit ? "Editar cliente" : "Nuevo cliente"} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !c.nombre.trim() || !tel || !!dup} onClick={() => run(async () => { if (await (edit ? actions.updateClient(edit.id, c) : actions.addClient(c))) onClose(); })}>{busy ? <Spinner /> : null} Guardar cliente</Btn></>}>
      <Field label="Nombre completo"><Input value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono"><Input type="tel" inputMode="tel" value={c.telefono} onChange={(e) => setC({ ...c, telefono: e.target.value })} /></Field>
        <Field label="Ciudad o zona"><Select value={c.zona} onChange={(e) => setC({ ...c, zona: e.target.value })} options={[...new Set(["Cercado", "Sacaba", "Quillacollo", "Tiquipaya", "Colcapirhua", "Vinto", "Sipe Sipe", "Punata", "Otra ciudad", c.zona].filter(Boolean))]} /></Field>
      </div>
      {dup && <p className="text-xs text-rose-600">Ese teléfono ya está registrado a nombre de {dup.nombre}.</p>}
      <Field label="Dirección de entrega"><Input value={c.direccion} onChange={(e) => setC({ ...c, direccion: e.target.value })} /></Field>
      <Field label="Observaciones"><Input value={c.obs} onChange={(e) => setC({ ...c, obs: e.target.value })} /></Field>
    </Modal>
  );
}

export function ClientDetail({ db, id, onClose, setModal, can }) {
  const c = db.clients.find((x) => x.id === id);
  if (!c) return null;
  const sales = db.sales.filter((s) => s.clienteId === id);
  return (
    <Modal wide title={c.nombre} onClose={onClose}>
      <a href={`https://wa.me/591${c.telefono.replace(/\D/g, "").replace(/^591/, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700"><Phone size={14} /> Escribir por WhatsApp</a>
      <div className="flex flex-wrap gap-4 text-sm text-slate-600"><span className="flex items-center gap-1"><Phone size={14} />{c.telefono}</span><span className="flex items-center gap-1"><MapPin size={14} />{c.direccion}</span><span>Cliente desde {fdate(c.fechaRegistro)}</span>{can.sell && <Btn size="sm" variant="outline" onClick={() => setModal({ type: "client", edit: c })}><Pencil size={13} /> Editar</Btn>}</div>
      {c.obs && <p className="text-sm text-slate-600">{c.obs}</p>}
      <Table head={["Venta", "Fecha", "Pares", "Total", "Pago"]} empty={!sales.length && "Todavía no tiene compras."}>
        {sales.map((s) => <tr key={s.id}><Td>{s.id}</Td><Td>{fdate(s.fecha)}</Td><Td>{s.items.map((i) => db.products.find((p) => p.id === i.productId)?.codigo).join(", ")}</Td><Td className="vx-num">{bs(saleTotal(s))}</Td><Td><Pill>{payState(db, s)}</Pill></Td></tr>)}
      </Table>
    </Modal>
  );
}
