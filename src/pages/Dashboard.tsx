import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function Dashboard({ db, m, go, userName, setModal }) {
  const [range, setRange] = useState(30);
  const daily = useMemo(() => Array.from({ length: range }, (_, k) => {
    const f = addDays(TODAY, -(range - 1 - k));
    return { dia: fdate(f).slice(0, 5), ventas: sum(m.active.filter((s) => s.fecha === f), saleTotal), cobrado: sum(db.payments.filter((p) => !p.anulado && p.fecha === f), (p) => p.monto) };
  }), [db, m, range]);
  const weekly = useMemo(() => Array.from({ length: 6 }, (_, k) => {
    const end = addDays(TODAY, -(5 - k) * 7), start = addDays(end, -6);
    const inR = (f) => f >= start && f <= end;
    return { semana: fdate(start).slice(0, 5), ingresos: sum(db.payments.filter((p) => !p.anulado && inR(p.fecha)), (p) => p.monto), gastos: sum(db.expenses.filter((e) => !e.anulado && inR(e.fecha)), (e) => e.monto) };
  }), [db]);
  const by = (key) => { const o = {}; m.active.forEach((s) => { const k = key(s); o[k] = o[k] || { name: k, ventas: 0, pares: 0 }; o[k].ventas += saleTotal(s); o[k].pares += s.items.length; }); return Object.values(o).sort((a, b) => b.ventas - a.ventas); };
  const canal = by((s) => s.canal), socio = by((s) => userName(s.socio));
  const origen = ["Americano", "Coreano"].map((o) => { const all = db.products.filter((p) => p.origen === o); const v = all.filter((p) => p.estado === "Vendido").length; return { name: o, vendidos: v, total: all.length, rot: all.length ? Math.round((v / all.length) * 100) : 0 }; });
  const tallas = [...new Set(db.products.map((p) => p.talla))].sort((a, b) => a - b).map((t) => ({ talla: String(t), Disponibles: db.products.filter((p) => p.talla === t && p.estado !== "Vendido").length, Vendidos: db.products.filter((p) => p.talla === t && p.estado === "Vendido").length }));
  const slow = db.products.filter((p) => p.estado === "Disponible" && diffDays(p.fechaIngreso, TODAY) >= db.config.diasBajaRotacion);
  const expiring = db.reservations.filter((r) => r.estado === "Activa" && (new Date(r.vence) - NOW) / 3600000 < 12);
  const pendOrders = db.sales.filter((s) => s.estado === "Activa" && s.pedido !== "Entregado");
  const owing = m.active.filter((s) => saleTotal(s) - paidOf(db, s.id) > 0);
  const pct = m.inversion ? Math.min(100, Math.round((m.recuperado / m.inversion) * 100)) : 0;
  const tip = { contentStyle: { borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }, formatter: (v) => bs0(v) };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 first-letter:uppercase">{fechaLarga(TODAY)} de {TODAY.slice(0, 4)}</p>
          <h1 className="vx-d text-2xl sm:text-3xl font-bold text-slate-900">Así va el negocio hoy</h1>
        </div>
      </div>

      {/* Bloque principal: capital y dinero */}
      <section className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-slate-900 text-white p-5">
          <div className="absolute -right-8 -top-6 w-52 h-52 opacity-20"><Isotipo className="w-full h-full" /></div>
          <div className="relative">
            <div className="text-sm text-slate-300">Capital recuperado</div>
            <div className="vx-d vx-num text-4xl font-extrabold mt-1">{pct}%</div>
            <div className="text-sm text-slate-300 mt-1 vx-num">{bs0(m.recuperado)} de {bs0(m.inversion)} invertidos</div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-700 overflow-hidden"><div className="h-full rounded-full vx-grad" style={{ width: pct + "%" }} /></div>
            <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
              <div><div className="text-slate-400 text-xs">Falta recuperar</div><div className="vx-num font-semibold">{bs0(m.porRecuperar)}</div></div>
              <div><div className="text-slate-400 text-xs">Inventario restante (a costo)</div><div className="vx-num font-semibold">{bs0(m.invCosto)}</div></div>
            </div>
            <p className="text-xs text-slate-400 mt-4">Recuperado = dinero cobrado − gastos operativos pagados.</p>
          </div>
        </div>
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Del registro de ventas a la ganancia</h3>
          <p className="text-xs text-slate-500 mb-4">Cada cifra mide algo distinto. Ninguna se suma con otra.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              ["Ventas registradas", m.ventas, "Lo que se vendió, cobrado o no", "slate"],
              ["Dinero cobrado", m.cobrado, `Incluye ${bs0(m.adelantos)} en adelantos de reservas`, "teal"],
              ["Por cobrar", m.pendiente, `${owing.length} ventas con saldo`, "rose"],
              ["Costo de lo vendido", m.costoVendido, "Costo real de cada par vendido", "slate"],
              ["Ganancia bruta", m.bruta, "Ventas − costo de lo vendido", "lila"],
              ["Ganancia neta estimada", m.neta, `Bruta − gastos (${bs0(m.gastos)})`, "lila"],
            ].map(([l, v, s, t]) => (
              <div key={l} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <div className="text-xs text-slate-500">{l}</div>
                <div className={`vx-d vx-num text-lg font-semibold ${t === "teal" ? "text-cyan-700" : t === "rose" ? "text-rose-600" : t === "lila" ? "text-purple-700" : "text-slate-900"}`}>{bs0(v)}</div>
                <div className="text-xs text-slate-500">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inventario y ventas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Pares disponibles" value={m.disp} sub={`de ${m.total} registrados`} tone="teal" icon={Package} />
        <Stat label="Pares reservados" value={m.res} sub={`${expiring.length} vencen en menos de 12 h`} tone="lila" icon={Clock} />
        <Stat label="Ventas de hoy" value={bs0(m.ventasHoy)} sub={`Mes: ${bs0(m.ventasMes)} · ${m.paresMes} pares`} tone="slate" icon={ShoppingBag} />
        <Stat label="Valor del inventario" value={bs0(m.invPrecio)} sub={`A precio de venta · a costo ${bs0(m.invCosto)}`} tone="slate" icon={Boxes} />
      </section>

      <Panel title="Estado del inventario" sub={`${m.total} pares individuales`}>
        <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-cyan-500" style={{ width: (m.total ? (m.disp / m.total) * 100 : 0) + "%" }} title="Disponibles" />
          <div className="bg-purple-400" style={{ width: (m.total ? (m.res / m.total) * 100 : 0) + "%" }} title="Reservados" />
          <div className="bg-slate-400" style={{ width: (m.total ? (m.vend / m.total) * 100 : 0) + "%" }} title="Vendidos" />
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-cyan-500" />Disponibles {m.disp}</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-purple-400" />Reservados {m.res}</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-slate-400" />Vendidos {m.vend}</span>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-2" title="Ventas y cobros por día" sub="La distancia entre ambas líneas es dinero que aún no entra" action={
          <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">{[7, 30].map((r) => <button key={r} onClick={() => setRange(r)} className={`px-2 py-1 rounded-md ${range === r ? "bg-white shadow-sm" : "text-slate-500"}`}>{r} días</button>)}</div>
        }>
          <div className="h-64"><ResponsiveContainer>
            <AreaChart data={daily} margin={{ left: -10, right: 8 }}>
              <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.lila} stopOpacity={0.35} /><stop offset="100%" stopColor={C.lila} stopOpacity={0} /></linearGradient><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={0.35} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} interval={range > 7 ? 4 : 0} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="ventas" name="Ventas registradas" stroke={C.lilaD} fill="url(#gv)" strokeWidth={2} />
              <Area type="monotone" dataKey="cobrado" name="Dinero cobrado" stroke={C.tealD} fill="url(#gc)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer></div>
        </Panel>
        <Panel title="Necesita atención">
          <ul className="space-y-2 text-sm">
            {[
              [BellRing, `${agendaEvents(db).filter((e) => reminderState(e)).length} recordatorios de la agenda`, "agenda", "lila"],
              [Clock, `${expiring.length} reservas vencen en menos de 12 h`, "reservas", "lila"],
              [Truck, `${pendOrders.length} pedidos sin entregar`, "pedidos", "slate"],
              [CreditCard, `${owing.length} ventas con saldo: ${bs0(m.pendiente)}`, "ventas", "rose"],
              [AlertTriangle, `${slow.length} pares con ${db.config.diasBajaRotacion}+ días sin venderse`, "inventario", "amber"],
            ].map(([I, t, to, tone], i) => (
              <li key={i}><button onClick={() => go(to)} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-left">
                <I size={16} className={tone === "lila" ? "text-purple-600" : tone === "rose" ? "text-rose-500" : tone === "amber" ? "text-amber-500" : "text-slate-500"} />
                <span className="flex-1">{t}</span><ChevronRight size={15} className="text-slate-400" />
              </button></li>
            ))}
          </ul>
          <Btn variant="outline" className="w-full mt-3" onClick={() => setModal({ type: "expense" })}><Receipt size={15} /> Registrar gasto</Btn>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Ingresos frente a gastos por semana" sub="Dinero que entró y salió de verdad">
          <div className="h-56"><ResponsiveContainer>
            <BarChart data={weekly} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ingresos" name="Ingresos cobrados" fill={C.teal} radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill={C.gray} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Panel>
        <Panel title="Ventas por canal" sub="Dónde se cierran más ventas">
          <div className="h-56"><ResponsiveContainer>
            <BarChart data={canal} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" hide /><YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={110} tickLine={false} axisLine={false} />
              <Tooltip {...tip} /><Bar dataKey="ventas" name="Ventas" fill={C.lila} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Panel>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Panel title="Ventas por socio">
          {!socio.length && <p className="text-sm text-slate-400 py-6 text-center">Todavía no hay ventas.</p>}
          {socio.map((s) => { const max = Math.max(...socio.map((x) => x.ventas)); return (
            <div key={s.name} className="mb-3">
              <div className="flex justify-between text-sm"><span>{s.name}</span><span className="vx-num font-medium">{bs0(s.ventas)}</span></div>
              <div className="h-2 rounded-full bg-slate-100 mt-1"><div className="h-full rounded-full bg-cyan-500" style={{ width: (max ? (s.ventas / max) * 100 : 0) + "%" }} /></div>
              <div className="text-xs text-slate-500 mt-0.5">{s.pares} pares vendidos</div>
            </div>); })}
        </Panel>
        <Panel title="Americano frente a coreano" sub="Rotación = vendidos ÷ registrados">
          <div className="flex items-center gap-4">
            <div className="h-36 w-36 shrink-0"><ResponsiveContainer>
              <PieChart><Pie data={origen} dataKey="vendidos" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={3}>{origen.map((o, i) => <Cell key={i} fill={i ? C.lila : C.teal} />)}</Pie><Tooltip contentStyle={tip.contentStyle} /></PieChart>
            </ResponsiveContainer></div>
            <div className="space-y-3 text-sm">{origen.map((o, i) => (
              <div key={o.name}><div className="flex items-center gap-1.5"><i className={`w-2.5 h-2.5 rounded-full ${i ? "bg-purple-400" : "bg-cyan-500"}`} />{o.name}</div><div className="text-xs text-slate-500 vx-num">{o.vendidos}/{o.total} vendidos · rotación {o.rot}%</div></div>
            ))}</div>
          </div>
        </Panel>
        <Panel title="Pares por talla" sub="Qué tallas salen y cuáles quedan" className="md:col-span-2 lg:col-span-1">
          <div className="h-40"><ResponsiveContainer>
            <BarChart data={tallas} margin={{ left: -25 }}>
              <XAxis dataKey="talla" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tip.contentStyle} />
              <Bar dataKey="Vendidos" stackId="a" fill={C.gray} /><Bar dataKey="Disponibles" stackId="a" fill={C.teal} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Panel>
      </div>
    </div>
  );
}
