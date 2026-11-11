import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function EventChip({ e, compact }) {
  const c = TIPOS_EVENTO[e.tipo];
  return (
    <div className={`truncate rounded px-1.5 py-0.5 text-xs ${e.hecho ? "line-through opacity-50" : ""}`} style={{ background: c + "1F", color: "#10142C", borderLeft: `3px solid ${c}` }}>
      {!compact && <span className="font-semibold vx-num">{e.hora} </span>}{e.titulo}
    </div>
  );
}

export function Agenda({ db, actions, setModal, go }) {
  const all = agendaEvents(db);
  const [tipos, setTipos] = useState(Object.keys(TIPOS_EVENTO));
  const [month, setMonth] = useState(TODAY.slice(0, 7));
  const [sel, setSel] = useState(TODAY);
  const [view, setView] = useState("mes");
  const evs = all.filter((e) => tipos.includes(e.tipo));
  const byDay = (iso) => evs.filter((e) => e.fecha === iso);
  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const weeks = cells[35].getMonth() === mo - 1 ? 6 : 5;
  const shift = (k) => { const d = new Date(y, mo - 1 + k, 1); setMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`); };
  const alerts = all.filter((e) => reminderState(e));
  const upcoming = evs.filter((e) => !e.hecho && e.fecha >= TODAY && e.fecha <= addDays(TODAY, 30));
  const dayEvents = byDay(sel);

  const EventRow = ({ e }) => {
    const st = reminderState(e);
    return (
      <div className={`rounded-xl border p-3 ${st === "activo" ? "border-purple-300 bg-purple-50" : st === "atrasado" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
        <div className="flex items-start gap-3">
          {!e.auto ? (
            <button onClick={() => actions.toggleEvent(e.id)} className={`mt-0.5 w-5 h-5 rounded-md border-2 grid place-items-center shrink-0 ${e.hecho ? "bg-cyan-500 border-cyan-500 text-white" : "border-slate-300"}`} aria-label={e.hecho ? "Marcar como pendiente" : "Marcar como hecha"}>{e.hecho && <CheckCircle2 size={13} />}</button>
          ) : <span className="mt-1.5 w-3 h-3 rounded-full shrink-0" style={{ background: TIPOS_EVENTO[e.tipo] }} />}
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${e.hecho ? "line-through text-slate-400" : "text-slate-900"}`}>{e.titulo}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
              <span className="vx-num font-medium text-slate-700">{e.hora}</span><span>{e.tipo}</span>
              {e.recordatorio > 0 && <span className="inline-flex items-center gap-1"><Bell size={11} />{recLabel(e.recordatorio)}</span>}
              {e.auto && <span className="text-purple-700">automática</span>}
            </div>
            {st && <div className={`text-xs font-medium mt-1 ${st === "atrasado" ? "text-rose-600" : "text-purple-700"}`}>{st === "atrasado" ? "Atrasada: ya pasó la hora" : "Recordatorio activo"}</div>}
            {e.notas && <p className="text-xs text-slate-600 mt-1">{e.notas}</p>}
          </div>
          <div className="flex gap-0.5">
            {e.auto ? (
              <Btn size="sm" variant="ghost" onClick={() => (e.ventaId ? setModal({ type: "order", ventaId: e.ventaId }) : go("reservas"))}>{e.ventaId ? "Ver pedido" : "Ver reserva"}</Btn>
            ) : (<>
              <button className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100" onClick={() => setModal({ type: "event", ev: e })} aria-label="Editar"><Pencil size={14} /></button>
              <button className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => { if (confirm(`¿Eliminar “${e.titulo}”?`)) actions.deleteEvent(e.id); }} aria-label="Eliminar"><Trash2 size={14} /></button>
            </>)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHead title="Agenda" route="/agenda" desc="Actividades programadas con recordatorio. Los envíos y vencimientos de reservas aparecen solos.">
        <Btn onClick={() => setModal({ type: "event", fecha: sel })}><Plus size={15} /> Nueva actividad</Btn>
      </PageHead>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-xl bg-slate-900 text-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3"><BellRing size={16} className="text-cyan-300" /> {alerts.length} recordatorio{alerts.length > 1 ? "s" : ""} ahora</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {alerts.map((e) => (
              <div key={e.id} className="shrink-0 w-64 rounded-lg bg-white text-slate-900 p-3">
                <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: TIPOS_EVENTO[e.tipo] }} /><span className="text-xs text-slate-500">{e.tipo}</span></div>
                <div className="text-sm font-semibold mt-1 truncate">{e.titulo}</div>
                <div className={`text-xs ${reminderState(e) === "atrasado" ? "text-rose-600 font-medium" : "text-slate-500"}`}>{reminderState(e) === "atrasado" ? "Atrasada · " : ""}{e.fecha === TODAY ? "Hoy" : fechaLarga(e.fecha)} a las {e.hora}</div>
                <div className="flex gap-1.5 mt-2">
                  {e.auto ? <Btn size="sm" variant="outline" onClick={() => (e.ventaId ? setModal({ type: "order", ventaId: e.ventaId }) : go("reservas"))}>Ver</Btn> : <Btn size="sm" onClick={() => actions.toggleEvent(e.id)}>Marcar como hecha</Btn>}
                  <Btn size="sm" variant="ghost" onClick={() => { setSel(e.fecha); setMonth(e.fecha.slice(0, 7)); }}>Ir al día</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(TIPOS_EVENTO).map(([t, c]) => {
          const on = tipos.includes(t);
          return <button key={t} onClick={() => setTipos(on ? tipos.filter((x) => x !== t) : [...tipos, t])} aria-pressed={on} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border ${on ? "bg-white border-slate-300 text-slate-800" : "bg-slate-100 border-transparent text-slate-400 line-through"}`}><span className="w-2.5 h-2.5 rounded-full" style={{ background: on ? c : "#cbd5e1" }} />{t}</button>;
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <section className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-md hover:bg-slate-100" onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
              <h2 className="vx-d text-base sm:text-lg font-bold capitalize w-32 sm:w-48 text-center">{MESES[mo - 1]} {y}</h2>
              <button className="p-1.5 rounded-md hover:bg-slate-100" onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
              <Btn size="sm" variant="outline" className="ml-1" onClick={() => { setMonth(TODAY.slice(0, 7)); setSel(TODAY); }}>Hoy</Btn>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs">{[["mes", "Mes"], ["lista", "Próximos 30 días"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} className={`px-2.5 py-1 rounded-md ${view === k ? "bg-white shadow-sm font-medium" : "text-slate-500"}`}>{l}</button>)}</div>
          </div>
          {view === "mes" ? (
            <div>
              <div className="grid grid-cols-7 border-b border-slate-100">{DIAS.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">{d}</div>)}</div>
              <div className="grid grid-cols-7">
                {cells.slice(0, weeks * 7).map((d) => {
                  const iso = isoLocal(d), list = byDay(iso), inMonth = d.getMonth() === mo - 1, isToday = iso === TODAY, isSel = iso === sel;
                  return (
                    <button key={iso} onClick={() => setSel(iso)} aria-label={`${fechaLarga(iso)}: ${list.length} actividades`} aria-pressed={isSel} className={`h-20 sm:h-28 overflow-hidden border-b border-r border-slate-100 p-1.5 text-left align-top flex flex-col gap-1 transition-colors ${isSel ? "bg-purple-50" : inMonth ? "bg-white hover:bg-slate-50" : "bg-slate-50"}`}>
                      <span className={`self-start text-xs w-6 h-6 grid place-items-center rounded-full vx-num ${isToday ? "bg-purple-700 text-white font-bold" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{d.getDate()}</span>
                      <div className="hidden sm:flex flex-col gap-0.5 w-full">
                        {list.slice(0, 3).map((e) => <EventChip key={e.id} e={e} />)}
                        {list.length > 3 && <span className="text-xs text-slate-500 px-1">+{list.length - 3} más</span>}
                      </div>
                      <div className="sm:hidden flex flex-wrap gap-0.5">{list.slice(0, 4).map((e) => <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: TIPOS_EVENTO[e.tipo] }} />)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {[...new Set(upcoming.map((e) => e.fecha))].map((f) => (
                <div key={f}>
                  <div className={`text-sm font-semibold mb-2 capitalize ${f === TODAY ? "text-purple-700" : "text-slate-700"}`}>{f === TODAY ? "Hoy, " : ""}{fechaLarga(f)}</div>
                  <div className="space-y-2">{upcoming.filter((e) => e.fecha === f).map((e) => <EventRow key={e.id} e={e} />)}</div>
                </div>
              ))}
              {!upcoming.length && <p className="text-sm text-slate-400 text-center py-10">No hay actividades en los próximos 30 días.</p>}
            </div>
          )}
        </section>

        <aside className="bg-white rounded-xl border border-slate-200 p-4 lg:sticky lg:top-20">
          <div className="flex items-center justify-between mb-3">
            <div><div className="text-xs text-slate-500">{sel === TODAY ? "Hoy" : sel < TODAY ? "Día pasado" : "Día seleccionado"}</div><h3 className="vx-d font-bold capitalize">{fechaLarga(sel)}</h3></div>
            <Btn size="sm" variant="lila" onClick={() => setModal({ type: "event", fecha: sel })}><Plus size={14} /> Agregar</Btn>
          </div>
          <div className="space-y-2">
            {dayEvents.map((e) => <EventRow key={e.id} e={e} />)}
            {!dayEvents.length && <p className="text-sm text-slate-400 py-8 text-center">Sin actividades este día.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function EventModal({ db, init, onClose, actions }) {
  const ed = init.ev;
  const [e, setE] = useState(ed ? { ...ed } : { titulo: "", tipo: "Envío", fecha: init.fecha && init.fecha >= TODAY ? init.fecha : TODAY, hora: "10:00", recordatorio: 1440, notas: "" });
  const [semanas, setSemanas] = useState(0);
  const [busy, run] = useBusy();
  const sugerencias = { "Envío": "Enviar pedido a…", "Llegada de fardo": "Llegada del fardo…", "Facebook Live": "Facebook Live", "Cobro": "Cobrar saldo a…", "Pago a proveedor": "Pagar a…", "Reserva": "Seguimiento de reserva…", "Otro": "" };
  const aviso = e.recordatorio > 0 ? new Date(evDate(e).getTime() - e.recordatorio * 60000) : null;
  return (
    <Modal title={ed ? "Editar actividad" : "Nueva actividad"} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !e.titulo.trim() || !e.fecha} onClick={() => run(async () => { if (await actions.saveEvent({ ...e, titulo: e.titulo.trim(), recordatorio: Number(e.recordatorio) }, semanas)) onClose(); })}>{ed ? "Guardar cambios" : "Agendar actividad"}</Btn></>}>
      <div>
        <div className="text-xs font-medium text-slate-600 mb-1">Tipo</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(TIPOS_EVENTO).filter(([t]) => t !== "Reserva").map(([t, c]) => <button key={t} type="button" onClick={() => setE({ ...e, tipo: t, titulo: e.titulo || sugerencias[t] })} aria-pressed={e.tipo === t} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border ${e.tipo === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}><span className="w-2 h-2 rounded-full" style={{ background: c }} />{t}</button>)}
        </div>
      </div>
      <Field label="Actividad"><Input value={e.titulo} placeholder="Ej.: Llegada del Fardo 3" onChange={(x) => setE({ ...e, titulo: x.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><Input type="date" value={e.fecha} onChange={(x) => setE({ ...e, fecha: x.target.value })} /></Field>
        <Field label="Hora"><Input type="time" value={e.hora} onChange={(x) => setE({ ...e, hora: x.target.value })} /></Field>
        <Field label="Recordatorio" hint={aviso ? `Aviso el ${fdate(isoLocal(aviso))} a las ${pad2(aviso.getHours())}:${pad2(aviso.getMinutes())}` : null}><Select value={e.recordatorio} onChange={(x) => setE({ ...e, recordatorio: Number(x.target.value) })} options={RECORDATORIOS.map(([v, l]) => ({ value: v, label: l }))} /></Field>
        {!ed && <Field label="Repetir"><Select value={semanas} onChange={(x) => setSemanas(Number(x.target.value))} options={[[0, "No se repite"], [3, "Cada semana, 1 mes"], [7, "Cada semana, 2 meses"]].map(([v, l]) => ({ value: v, label: l }))} /></Field>}
      </div>
      <Field label="Notas"><Input value={e.notas} placeholder="Detalles, contacto, qué preparar" onChange={(x) => setE({ ...e, notas: x.target.value })} /></Field>
      <p className="text-xs text-slate-500">El recordatorio aparece en la campana, en el Dashboard y arriba de la agenda para los dos socios.</p>
    </Modal>
  );
}
