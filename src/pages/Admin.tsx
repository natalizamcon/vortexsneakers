import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function Activity({ db, userName }) {
  const [u, setU] = useState("todos");
  const list = db.audit.filter((a) => u === "todos" || a.user === u).sort((a, b) => b.ts.localeCompare(a.ts));
  return (
    <div>
      <PageHead title="Actividad" route="/actividad" desc="Registro de quién hizo qué y cuándo (últimas 800 acciones). Nadie puede editarlo ni borrarlo.">
        <div className="w-56"><Select value={u} onChange={(e) => setU(e.target.value)} options={[{ value: "todos", label: "Todos los usuarios" }, ...db.users.map((x) => ({ value: x.id, label: x.nombre }))]} /></div>
      </PageHead>
      <Panel>
        {!list.length && <p className="text-sm text-slate-400 text-center py-8">Todavía no hay actividad registrada.</p>}
        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
          {list.map((a) => (
            <li key={a.id} className="ml-5">
              <span className={`absolute -left-2 w-3 h-3 rounded-full ring-4 ring-white ${db.users.findIndex((x) => x.id === a.user) % 2 ? "bg-purple-500" : "bg-cyan-500"}`} />
              <div className="text-sm"><span className="font-medium">{userName(a.user)}</span> · {a.accion} <span className="font-medium">{a.entidad}</span></div>
              <div className="text-xs text-slate-500">{a.detalle} · {ftime(a.ts)}</div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

export function ConfigPage({ db, actions }) {
  const [canal, setCanal] = useState("");
  const [met, setMet] = useState("");
  const [dest, setDest] = useState("");
  const cfg = db.config;
  return (
    <div>
      <PageHead title="Configuración" route="/configuracion" desc="Listas y reglas que el sistema usa en todos los módulos." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Canales de venta">
          <div className="flex flex-wrap gap-2 mb-3">{cfg.canales.map((c) => <Chip key={c} tone="Activa" onRemove={() => { if (confirm(`¿Quitar “${c}”?`)) actions.setConfig({ canales: cfg.canales.filter((x) => x !== c) }); }}>{c}</Chip>)}</div>
          <div className="flex gap-2"><Input placeholder="Nuevo canal (ej.: Marketplace)" value={canal} onChange={(e) => setCanal(e.target.value)} /><Btn disabled={!canal} onClick={async () => { if (await actions.setConfig({ canales: [...cfg.canales, canal.trim()] })) setCanal(""); }}>Agregar</Btn></div>
        </Panel>
        <Panel title="Destinos de encomienda" sub="Los 9 departamentos vienen cargados; agrega provincias u otros lugares">
          <div className="flex flex-wrap gap-2 mb-3">{cfg.destinos.map((c) => <Chip key={c} tone={DEPARTAMENTOS.includes(c) ? "Americano" : "Coreano"} onRemove={() => { if (confirm(`¿Quitar “${c}”?`)) actions.setConfig({ destinos: cfg.destinos.filter((x) => x !== c) }); }}>{c}</Chip>)}</div>
          <div className="flex gap-2"><Input placeholder="Nuevo destino (ej.: Montero)" value={dest} onChange={(e) => setDest(e.target.value)} /><Btn disabled={!dest.trim()} onClick={async () => { if (await actions.addDestino(dest.trim())) setDest(""); }}>Agregar</Btn></div>
        </Panel>
        <Panel title="Métodos de pago">
          <div className="flex flex-wrap gap-2 mb-3">{cfg.metodos.map((c) => <Chip key={c} tone="Disponible" onRemove={() => { if (confirm(`¿Quitar “${c}”?`)) actions.setConfig({ metodos: cfg.metodos.filter((x) => x !== c) }); }}>{c}</Chip>)}</div>
          <div className="flex gap-2"><Input placeholder="Nuevo método (ej.: Tigo Money)" value={met} onChange={(e) => setMet(e.target.value)} /><Btn disabled={!met} onClick={async () => { if (await actions.setConfig({ metodos: [...cfg.metodos, met.trim()] })) setMet(""); }}>Agregar</Btn></div>
        </Panel>
        <Panel title="Reglas de operación">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vigencia de reservas por defecto"><Select value={cfg.vigenciaHoras} onChange={(e) => actions.setConfig({ vigenciaHoras: Number(e.target.value) })} options={[24, 48, 72].map((h) => ({ value: h, label: `${h} horas` }))} /></Field>
            <Field label="Baja rotación desde"><Select value={cfg.diasBajaRotacion} onChange={(e) => actions.setConfig({ diasBajaRotacion: Number(e.target.value) })} options={[15, 30, 45, 60].map((d) => ({ value: d, label: `${d} días` }))} /></Field>
          </div>
        </Panel>
        <Panel title="Identidad visual">
          <div className="flex gap-3">{[["Turquesa", C.teal], ["Lila", C.lila], ["Blanco", "#ffffff"], ["Gris", C.gray], ["Tinta", C.ink]].map(([n, h]) => <div key={n} className="text-center"><div className="w-12 h-12 rounded-xl border border-slate-200" style={{ background: h }} /><div className="text-xs text-slate-500 mt-1">{n}</div></div>)}</div>
        </Panel>
      </div>
    </div>
  );
}

export function SearchModal({ db, onClose, setDrawer, setModal }) {
  const [q, setQ] = useState("");
  const s = q.toLowerCase();
  const ps = q ? db.products.filter((p) => `${p.codigo} ${p.marca} ${p.modelo}`.toLowerCase().includes(s)).slice(0, 6) : [];
  const cs = q ? db.clients.filter((c) => `${c.nombre} ${c.telefono}`.toLowerCase().includes(s)).slice(0, 4) : [];
  return (
    <Modal title="Buscar" onClose={onClose}>
      <Input autoFocus placeholder="V012, Nike, María, 7123…" value={q} onChange={(e) => setQ(e.target.value)} />
      {ps.length > 0 && <div><div className="text-xs text-slate-500 mb-1">Pares</div>{ps.map((p) => <button key={p.id} onClick={() => { onClose(); setDrawer(p.id); }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 text-left"><span className="w-10 h-8 rounded overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></span><span className="text-sm flex-1"><b>{p.codigo}</b> {p.marca} {p.modelo} · T{p.talla}</span><Pill>{p.estado}</Pill></button>)}</div>}
      {cs.length > 0 && <div><div className="text-xs text-slate-500 mb-1">Clientes</div>{cs.map((c) => <button key={c.id} onClick={() => { onClose(); setModal({ type: "clientDetail", id: c.id }); }} className="w-full flex justify-between p-2 rounded-lg hover:bg-slate-50 text-sm"><span>{c.nombre}</span><span className="text-slate-500">{c.telefono}</span></button>)}</div>}
      {q && !ps.length && !cs.length && <p className="text-sm text-slate-400">Sin resultados para “{q}”.</p>}
    </Modal>
  );
}

export const Chip = ({ children, tone, onRemove }) => (
  <span className="inline-flex items-center gap-1">
    <Pill tone={tone}>{children}</Pill>
    {onRemove && <button className="text-slate-300 hover:text-rose-500" aria-label={`Quitar ${children}`} onClick={onRemove}><X size={13} /></button>}
  </span>
);

export const PERMS = [
  ["Dashboard e indicadores financieros", "✓", "—", "—"], ["Agenda", "✓", "✓", "✓"], ["Inventario: ver", "✓", "✓", "✓"],
  ["Inventario: crear, editar y fotos", "✓", "—", "✓"], ["Compras y lotes", "✓", "—", "✓"], ["Reservas", "✓", "✓", "—"],
  ["Ventas y pagos", "✓", "✓", "—"], ["Anular ventas", "✓", "—", "—"], ["Pedidos y entregas", "✓", "✓", "✓"],
  ["Clientes", "✓", "✓", "—"], ["Finanzas y gastos", "✓", "—", "—"], ["Reportes", "✓", "—", "—"], ["Usuarios, actividad y configuración", "✓", "—", "—"],
];

export function UsersPage({ db, setModal, me }) {
  const activos = db.users.filter((u) => u.activo);
  const sinAcceso = db.users.filter((u) => !u.activo);
  const Fila = ({ u }) => (
    <div className={`flex items-center gap-3 py-3 ${u.activo ? "" : "opacity-60"}`}>
      <div className="w-10 h-10 rounded-full vx-grad text-white grid place-items-center text-xs font-bold shrink-0">{(u.nombre || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{u.nombre}{u.id === me && <span className="text-xs font-normal text-slate-500"> (tú)</span>}</div>
        <div className="text-xs text-slate-500 truncate">{u.email}</div>
      </div>
      <Pill tone={u.activo ? (u.rolKey === "admin" ? "Activa" : "Disponible") : "Cancelada"}>{u.activo ? u.rol : "Sin acceso"}</Pill>
      <button className="p-2 rounded-md text-slate-500 hover:bg-slate-100" aria-label={`Editar ${u.nombre}`} onClick={() => setModal({ type: "user", edit: u })}><UserCog size={16} /></button>
    </div>
  );
  return (
    <div>
      <PageHead title="Usuarios y permisos" route="/usuarios" desc="Crea aquí las cuentas de tus socios, vendedores o encargados. Cada uno entra con su correo y contraseña.">
        <Btn onClick={() => setModal({ type: "user" })}><UserPlus size={15} /> Crear usuario</Btn>
      </PageHead>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Panel title={`Usuarios con acceso (${activos.length})`}>
          <div className="divide-y divide-slate-100 -my-3">{activos.map((u) => <Fila key={u.id} u={u} />)}</div>
          {sinAcceso.length > 0 && <>
            <div className="text-xs font-semibold text-slate-500 mt-5 mb-1">Sin acceso ({sinAcceso.length})</div>
            <div className="divide-y divide-slate-100">{sinAcceso.map((u) => <Fila key={u.id} u={u} />)}</div>
          </>}
        </Panel>
        <Panel title="Qué puede hacer cada rol">
          <Table head={["Módulo", "Administrador", "Vendedor", "Inventario"]}>
            {PERMS.map((r) => <tr key={r[0]}><Td className="whitespace-normal">{r[0]}</Td>{r.slice(1).map((v, i) => <Td key={i} className={v === "✓" ? "text-cyan-600 font-semibold text-center" : "text-slate-300 text-center"}>{v}</Td>)}</tr>)}
          </Table>
          <p className="text-xs text-slate-500 mt-3">Estas reglas también están protegidas en la base de datos: aunque alguien intente saltarse la pantalla, no podrá hacer lo que su rol no permite.</p>
        </Panel>
      </div>
    </div>
  );
}

export function UserModal({ onClose, actions, edit = null, me }) {
  const [u, setU] = useState(edit ? { nombre: edit.nombre, email: edit.email, rol: edit.rolKey, activo: edit.activo, password: "" } : { nombre: "", email: "", rol: "vendedor", activo: true, password: "" });
  const [pw, setPw] = useState("");
  const [busy, run] = useBusy();
  const soyYo = edit && edit.id === me;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email.trim());
  const roles = Object.entries(ROLES).map(([value, label]) => ({ value, label }));
  if (edit) {
    return (
      <Modal title={`Editar ${edit.nombre}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !u.nombre.trim()} onClick={() => run(async () => { if (await actions.updateUser(edit.id, u)) onClose(); })}>{busy ? <Spinner /> : null} Guardar cambios</Btn></>}>
        <div className="text-sm text-slate-500">{edit.email}</div>
        <Field label="Nombre"><Input value={u.nombre} onChange={(e) => setU({ ...u, nombre: e.target.value })} /></Field>
        <Field label="Rol" hint={soyYo ? "No puedes quitarte tu propio rol de administrador." : null}><Select value={u.rol} disabled={soyYo} onChange={(e) => setU({ ...u, rol: e.target.value })} options={roles} /></Field>
        <label className={`flex items-center gap-2 text-sm ${soyYo ? "opacity-50" : ""}`}>
          <input type="checkbox" className="w-4 h-4 accent-purple-700" checked={u.activo} disabled={soyYo} onChange={(e) => setU({ ...u, activo: e.target.checked })} />
          Puede entrar al sistema
        </label>
        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><KeyRound size={14} /> Cambiar su contraseña</div>
          <div className="flex gap-2">
            <div className="flex-1"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nueva contraseña (mín. 6)" autoComplete="new-password" /></div>
            <Btn variant="outline" disabled={busy || pw.length < 6} onClick={() => run(async () => { if (await actions.setUserPassword(edit.id, pw)) setPw(""); })}>Cambiar</Btn>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Crear usuario" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !u.nombre.trim() || !emailOk || u.password.length < 6} onClick={() => run(async () => { if (await actions.createUser({ ...u, email: u.email.trim() })) onClose(); })}>{busy ? <Spinner /> : null} Crear usuario</Btn></>}>
      <Field label="Nombre"><Input value={u.nombre} placeholder="Ej.: María Rojas" onChange={(e) => setU({ ...u, nombre: e.target.value })} /></Field>
      <Field label="Correo (con este entrará)"><Input type="email" inputMode="email" autoComplete="off" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></Field>
      <Field label="Contraseña" hint="Mínimo 6 caracteres. Compártela con la persona; luego puede cambiarla desde su menú."><PasswordInput value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} autoComplete="new-password" /></Field>
      <Field label="Rol"><Select value={u.rol} onChange={(e) => setU({ ...u, rol: e.target.value })} options={roles} /></Field>
      <Note tone="teal">La cuenta queda lista al instante: no hace falta confirmar el correo ni entrar a Supabase.</Note>
    </Modal>
  );
}

export function MyPasswordModal({ onClose, actions }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, run] = useBusy();
  const ok = a.length >= 6 && a === b;
  return (
    <Modal title="Cambiar mi contraseña" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !ok} onClick={() => run(async () => { if (await actions.changeMyPassword(a)) onClose(); })}>{busy ? <Spinner /> : null} Cambiar contraseña</Btn></>}>
      <Field label="Nueva contraseña"><PasswordInput value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" /></Field>
      <Field label="Repite la nueva contraseña" hint={b && a !== b ? "No coinciden." : null}><PasswordInput value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></Field>
    </Modal>
  );
}
