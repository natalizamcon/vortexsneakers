import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function Reports({ db, userName, client, toast }) {
  const [rep, setRep] = useState("socio");
  const [from, setFrom] = useState(addDays(TODAY, -30));
  const [to, setTo] = useState(TODAY);
  const sales = db.sales.filter((s) => s.estado === "Activa" && s.fecha >= from && s.fecha <= to);
  const items = sales.flatMap((s) => s.items.map((i) => ({ ...i, s, p: db.products.find((p) => p.id === i.productId) })));
  const group = (key, label) => { const o = {}; items.forEach((i) => { const k = key(i); o[k] = o[k] || { [label]: k, Pares: 0, Ventas: 0, Utilidad: 0 }; o[k].Pares++; o[k].Ventas += i.precio; o[k].Utilidad += i.precio - i.costo; }); return Object.values(o).sort((a, b) => b.Ventas - a.Ventas); };
  const VU = ["Ventas", "Utilidad"];
  const REPS = {
    socio: { label: "Ventas por socio", icon: Users, rows: () => group((i) => userName(i.s.socio), "Socio"), bars: VU },
    canal: { label: "Ventas por canal", icon: ShoppingBag, rows: () => group((i) => i.s.canal, "Canal"), bars: VU },
    talla: { label: "Ventas por talla", icon: LayoutGrid, rows: () => group((i) => "T" + i.p.talla, "Talla").sort((a, b) => a.Talla.localeCompare(b.Talla)), bars: ["Pares"] },
    origen: { label: "Americano frente a coreano", icon: Layers, rows: () => group((i) => i.p.origen, "Origen"), bars: VU },
    marca: { label: "Marcas más vendidas", icon: Package, rows: () => group((i) => i.p.marca, "Marca"), bars: VU },
    ganancia: { label: "Ganancia por producto", icon: Wallet, rows: () => items.map((i) => ({ Código: i.p.codigo, Producto: `${i.p.marca} ${i.p.modelo}`, Precio: i.precio, Costo: i.costo, Utilidad: i.precio - i.costo, Margen: Math.round(((i.precio - i.costo) / i.precio) * 100) + "%" })).sort((a, b) => b.Utilidad - a.Utilidad), bars: ["Utilidad"], top: 12 },
    rotacion: { label: "Baja rotación", icon: Clock, rows: () => db.products.filter((p) => p.estado === "Disponible").map((p) => ({ Código: p.codigo, Producto: `${p.marca} ${p.modelo}`, Talla: p.talla, "Días en stock": diffDays(p.fechaIngreso, TODAY), Precio: p.precio })).sort((a, b) => b["Días en stock"] - a["Días en stock"]), bars: ["Días en stock"], top: 12 },
    clientes: { label: "Clientes frecuentes", icon: UserPlus, rows: () => { const o = {}; sales.forEach((s) => { const n = client(s.clienteId)?.nombre; o[n] = o[n] || { Cliente: n, Compras: 0, Ventas: 0 }; o[n].Compras++; o[n].Ventas += saleTotal(s); }); return Object.values(o).sort((a, b) => b.Ventas - a.Ventas); }, bars: ["Ventas"], top: 10 },
    destinos: { label: "Envíos por destino", icon: Truck, rows: () => { const o = {}; sales.forEach((s) => { const k = s.entrega.tipo === "Encomienda" ? s.entrega.destino : s.entrega.tipo === "Recojo en punto" ? "Recojo en punto" : "Cochabamba (delivery)"; o[k] = o[k] || { Destino: k, Pedidos: 0, Ventas: 0 }; o[k].Pedidos++; o[k].Ventas += saleTotal(s); }); return Object.values(o).sort((a, b) => b.Pedidos - a.Pedidos); }, bars: ["Pedidos"] },
    gastos: { label: "Gastos por categoría", icon: Receipt, rows: () => GASTO_CATS.map((c) => { const es = db.expenses.filter((e) => !e.anulado && e.categoria === c && e.fecha >= from && e.fecha <= to); return { Categoría: c, Movimientos: es.length, Importe: sum(es, (e) => e.monto) }; }).filter((x) => x.Movimientos), bars: ["Importe"] },
    canceladas: { label: "Reservas canceladas", icon: Ban, rows: () => db.reservations.filter((r) => r.estado === "Cancelada").map((r) => ({ Reserva: r.id, Par: db.products.find((p) => p.id === r.productId)?.codigo, Cliente: client(r.clienteId)?.nombre, Canal: r.canal, Fecha: fdate(r.creado), Motivo: r.obs })), chart: (rows) => { const o = {}; rows.forEach((r) => { o[r.Canal] = o[r.Canal] || { Canal: r.Canal, Canceladas: 0 }; o[r.Canal].Canceladas++; }); return Object.values(o); }, bars: ["Canceladas"] },
  };
  const R = REPS[rep];
  const rows = R.rows();
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const data = R.chart ? R.chart(rows) : rows.slice(0, R.top || 15);
  const xKey = data[0] ? Object.keys(data[0])[0] : "";
  const money = ["Ventas", "Utilidad", "Precio", "Costo", "Importe"];
  const fmt = (k, v) => (money.includes(k) ? bs0(v) : v);
  const palette = [C.lilaD, C.teal];
  return (
    <div>
      <PageHead title="Reportes" route="/reportes" desc="Elige un reporte en la lista. El gráfico y el detalle aparecen a la derecha.">
        <Btn variant="outline" className="print:hidden" disabled={!rows.length} onClick={() => exportarCSV(`vortex-${rep}-${from}-a-${to}`, rows)}><Download size={15} /> Excel</Btn>
        <Btn variant="outline" className="print:hidden" onClick={() => window.print()}><Printer size={15} /> PDF / imprimir</Btn>
      </PageHead>
      <div className="grid sm:grid-cols-12 gap-4 items-start">
        <nav className="print:hidden sm:col-span-4 lg:col-span-3 bg-white rounded-xl border border-slate-200 p-2 sm:sticky sm:top-20 flex sm:block gap-1 overflow-x-auto vx-noscroll" aria-label="Lista de reportes">
          {Object.entries(REPS).map(([k, r]) => { const I = r.icon; return (
            <button key={k} onClick={() => setRep(k)} aria-current={rep === k} className={`shrink-0 sm:w-full flex items-center gap-2.5 text-left text-sm px-3 py-2 rounded-lg whitespace-nowrap sm:whitespace-normal ${rep === k ? "bg-purple-50 text-purple-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
              <I size={16} className={rep === k ? "text-purple-700" : "text-slate-400"} />{r.label}
            </button>); })}
        </nav>
        <div className="sm:col-span-8 lg:col-span-9 space-y-4 print:col-span-12">
          <Panel title={R.label} sub={`${sales.length} ventas entre el ${fdate(from)} y el ${fdate(to)}${R.top && rows.length > R.top ? ` · gráfico con los ${R.top} primeros` : ""}`} action={
            <div className="flex gap-2">
              <input type="date" aria-label="Desde" className={inputCls + " w-full sm:w-36 py-1.5"} value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" aria-label="Hasta" className={inputCls + " w-full sm:w-36 py-1.5"} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          }>
            {data.length ? (
              <div className="h-72"><ResponsiveContainer>
                <BarChart data={data} margin={{ left: -5, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" vertical={false} />
                  <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v, n) => fmt(n, v)} contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  {R.bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                  {R.bars.map((b, i) => <Bar key={b} dataKey={b} fill={palette[i % 2]} radius={[4, 4, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer></div>
            ) : <p className="text-center text-sm text-slate-400 py-16">No hay datos para este período. Amplía las fechas.</p>}
          </Panel>
          <Panel title="Detalle">
            <Table head={cols} empty={!rows.length && "No hay datos para este período."}>
              {rows.slice(0, 50).map((r, i) => <tr key={i}>{cols.map((c) => <Td key={c} className={money.includes(c) ? "vx-num" : ""}>{money.includes(c) ? bs(r[c]) : r[c]}</Td>)}</tr>)}
            </Table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
