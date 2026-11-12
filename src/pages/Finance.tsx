import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function Finance({ db, m, setModal, userName, actions }) {
  const [tab, setTab] = useState("todos");
  const movs = [
    ...db.payments.filter((p) => !p.anulado).map((p) => ({ id: p.id, fecha: p.fecha, tipo: "Ingreso", concepto: p.ventaId ? `Cobro de ${p.ventaId}` : `Adelanto de ${p.reservaId}`, categoria: p.ventaId ? "Cobro de venta" : "Adelanto de reserva", monto: p.monto, metodo: p.metodo, socio: p.socio, auto: true })),
    ...db.otherIncome.map((e) => ({ ...e, tipo: "Ingreso", categoria: "Otros ingresos" })),
    ...db.expenses.filter((e) => !e.anulado).map((e) => ({ ...e, tipo: "Gasto" })),
    ...db.lots.map((l) => ({ id: l.id, fecha: l.fecha, tipo: "Inversión", concepto: `Compra ${l.nombre}`, categoria: "Compra de mercadería", monto: lotTotal(l), metodo: "—", socio: l.socio, auto: true })),
  ].filter((x) => tab === "todos" || x.tipo === tab).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cats = GASTO_CATS.map((c) => ({ name: c, value: sum(db.expenses.filter((e) => !e.anulado && e.categoria === c), (e) => e.monto) })).filter((x) => x.value > 0);
  const Row = ({ l, v, strong, minus, tone }) => <div className={`flex justify-between py-1.5 ${strong ? "font-semibold border-t border-slate-200 mt-1 pt-2" : ""} ${tone || ""}`}><span>{minus && "− "}{l}</span><span className="vx-num">{bs(v)}</span></div>;
  return (
    <div>
      <PageHead title="Finanzas" route="/finanzas" desc="Resultado, caja y capital se calculan por separado para no mezclar conceptos.">
        <Btn variant="outline" onClick={() => setModal({ type: "income" })}><Plus size={15} /> Otro ingreso</Btn>
        <Btn onClick={() => setModal({ type: "expense" })}><Receipt size={15} /> Registrar gasto</Btn>
      </PageHead>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Panel title="Estado de resultados" sub="¿Cuánto estamos ganando?">
          <div className="text-sm">
            <Row l="Ventas registradas" v={m.ventas} /><Row l="Costo de los pares vendidos" v={m.costoVendido} minus />
            <Row l="Ganancia bruta" v={m.bruta} strong tone="text-purple-700" /><Row l="Gastos operativos" v={m.gastos} minus />{m.costoBajas > 0 && <Row l={`Pares dados de baja (${m.nBajas})`} v={m.costoBajas} minus />}<Row l="Otros ingresos" v={m.otros} />
            <Row l="Ganancia neta estimada" v={m.neta} strong tone="text-purple-700" />
          </div>
        </Panel>
        <Panel title="Flujo de dinero" sub="¿Cuánto dinero tenemos de verdad?">
          <div className="text-sm">
            <Row l="Cobros de ventas" v={m.cobradoVentas} /><Row l="Adelantos de reservas activas" v={m.adelantos} /><Row l="Otros ingresos" v={m.otros} />
            <Row l="Gastos pagados" v={m.gastos} minus /><Row l="Compras de mercadería" v={m.inversion} minus />
            <Row l="Caja neta desde el inicio" v={m.cobrado + m.otros - m.gastos - m.inversion} strong tone={m.cobrado + m.otros - m.gastos - m.inversion < 0 ? "text-rose-600" : "text-cyan-700"} />
          </div>
        </Panel>
        <Panel title="Capital" sub="¿Ya recuperamos lo invertido?">
          <div className="text-sm">
            <Row l="Inversión total acumulada" v={m.inversion} /><Row l="Capital recuperado" v={m.recuperado} tone="text-cyan-700" /><Row l="Pendiente de recuperar" v={m.porRecuperar} />
            <Row l="Cuentas por cobrar" v={m.pendiente} tone="text-rose-600" /><Row l="Inventario restante a costo" v={m.invCosto} />
          </div>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2" title="Movimientos" action={<div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 text-xs overflow-x-auto vx-noscroll max-w-full">{[["todos", "Todos"], ["Ingreso", "Ingresos"], ["Gasto", "Gastos"], ["Inversión", "Inversión"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-2 py-1 rounded-md ${tab === k ? "bg-white shadow-sm" : "text-slate-500"}`}>{l}</button>)}</div>}>
          <Table head={["Fecha", "Concepto", "Categoría", "Método", "Socio", "Importe", ""]} empty={!movs.length && "Todavía no hay movimientos."} mobile={movs.slice(0, 40).map((x) => (
            <MRow key={x.id}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0"><div className="text-sm font-medium truncate">{x.concepto}</div><div className="text-xs text-slate-500">{fdate(x.fecha)} · {x.categoria} · {x.metodo}{x.auto ? " · automático" : ""}</div></div>
                <div className={`vx-num text-sm font-semibold shrink-0 ${x.tipo === "Ingreso" ? "text-cyan-700" : "text-slate-700"}`}>{x.tipo === "Ingreso" ? "+" : "−"} {bs0(x.monto)}</div>
              </div>
            </MRow>
          ))}>
            {movs.slice(0, 40).map((x) => (
              <tr key={x.id}>
                <Td>{fdate(x.fecha)}</Td><Td>{x.concepto}{x.auto && <span className="ml-1.5 text-xs text-purple-600 bg-purple-50 rounded px-1">automático</span>}</Td><Td className="text-slate-500">{x.categoria}</Td><Td>{x.metodo}</Td><Td>{userName(x.socio)}</Td>
                <Td className={`vx-num font-medium text-right ${x.tipo === "Ingreso" ? "text-cyan-700" : "text-slate-700"}`}>{x.tipo === "Ingreso" ? "+" : "−"} {bs(x.monto)}</Td>
                <Td>{x.tipo === "Gasto" && <button className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Anular gasto" onClick={() => { if (confirm(`¿Anular el gasto “${x.concepto}”?`)) actions.annulExpense(x.id); }}><Trash2 size={14} /></button>}</Td>
              </tr>
            ))}
          </Table>
          <p className="text-xs text-slate-500 mt-3">Los cobros llegan aquí solos desde Ventas y Reservas, y las compras desde Lotes. No se cargan a mano, así nada se cuenta dos veces.</p>
        </Panel>
        <Panel title="Gastos por categoría">
          <div className="h-44"><ResponsiveContainer><PieChart><Pie data={cats} dataKey="value" nameKey="name" innerRadius={40} outerRadius={68} paddingAngle={2}>{cats.map((_, i) => <Cell key={i} fill={[C.teal, C.lila, C.gray, "#5eead4", "#c4b5fd", "#cbd5e1"][i]} />)}</Pie><Tooltip formatter={(v) => bs0(v)} /></PieChart></ResponsiveContainer></div>
          {cats.map((c, i) => <div key={c.name} className="flex justify-between text-sm py-1"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: [C.teal, C.lila, C.gray, "#5eead4", "#c4b5fd", "#cbd5e1"][i] }} />{c.name}</span><span className="vx-num">{bs0(c.value)}</span></div>)}
        </Panel>
      </div>
    </div>
  );
}

export function ExpenseModal({ db, onClose, actions }) {
  const [busy, run] = useBusy();
  const [e, setE] = useState({ fecha: TODAY, concepto: "", categoria: "Delivery", monto: "", metodo: "Efectivo", obs: "" });
  return (
    <Modal title="Registrar gasto" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !e.concepto.trim() || !(Number(e.monto) > 0)} onClick={() => run(async () => { if (await actions.addExpense(e)) onClose(); })}>{busy ? <Spinner /> : null} Registrar gasto</Btn></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={e.fecha} onChange={(x) => setE({ ...e, fecha: x.target.value })} /></Field>
        <Field label="Categoría"><Select value={e.categoria} onChange={(x) => setE({ ...e, categoria: x.target.value })} options={GASTO_CATS} /></Field>
      </div>
      <Field label="Concepto"><Input value={e.concepto} onChange={(x) => setE({ ...e, concepto: x.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Importe (Bs)"><Input type="number" value={e.monto} onChange={(x) => setE({ ...e, monto: x.target.value })} /></Field>
        <Field label="Método de pago"><Select value={e.metodo} onChange={(x) => setE({ ...e, metodo: x.target.value })} options={db.config.metodos} /></Field>
      </div>
      <p className="text-xs text-slate-500">La compra de fardos se registra en Compras y lotes, no aquí: es inversión, no gasto operativo.</p>
    </Modal>
  );
}

export function IncomeModal({ db, onClose, actions }) {
  const [busy, run] = useBusy();
  const [e, setE] = useState({ concepto: "", monto: "", metodo: "Efectivo" });
  return (
    <Modal title="Otro ingreso" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !e.concepto.trim() || !(Number(e.monto) > 0)} onClick={() => run(async () => { if (await actions.addIncome(e)) onClose(); })}>{busy ? <Spinner /> : null} Registrar ingreso</Btn></>}>
      <Field label="Concepto" hint="Para ingresos que no vienen de una venta. Los cobros de ventas se registran desde Ventas."><Input value={e.concepto} onChange={(x) => setE({ ...e, concepto: x.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Importe (Bs)"><Input type="number" value={e.monto} onChange={(x) => setE({ ...e, monto: x.target.value })} /></Field>
        <Field label="Método"><Select value={e.metodo} onChange={(x) => setE({ ...e, metodo: x.target.value })} options={db.config.metodos} /></Field>
      </div>
    </Modal>
  );
}
