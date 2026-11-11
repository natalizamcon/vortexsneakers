import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV } from "../lib/utils";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function ProductCard({ p, onClick, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-cyan-400 transition-colors flex flex-col">
      <button onClick={onClick} className="text-left flex-1">
        <div className="relative aspect-video vx-photo overflow-hidden">
          <ProductPhoto p={p} />
          <span className="absolute top-2 left-2 vx-d text-xs font-bold bg-white rounded-md px-1.5 py-0.5 text-slate-900">{p.codigo}</span>
          <span className="absolute top-2 right-2"><Pill>{p.estado}</Pill></span>
          <span className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-slate-500 bg-white rounded px-1.5"><Camera size={11} />{p.fotos}</span>
        </div>
        <div className="p-3">
          <div className="text-sm font-semibold text-slate-900 truncate">{p.marca} {p.modelo}</div>
          <div className="text-xs text-slate-500 mt-0.5">Talla {p.talla} · {p.color} · {p.origen === "Americano" ? "US" : "KR"}</div>
          <div className="flex items-end justify-between mt-2">
            <span className="vx-d vx-num text-base font-bold text-slate-900">{bs0(p.precio)}</span>
            <span className="text-xs text-cyan-700 vx-num">+{bs0(p.precio - pCost(p))}</span>
          </div>
        </div>
      </button>
      {children}
    </div>
  );
}

export function Inventory({ db, setDrawer, setModal, toast, actions, client, userName, can }) {
  const [tab, setTab] = useState("Disponible");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ origen: "Todos", talla: "Todas", marca: "Todas", max: "" });
  const [view, setView] = useState("cards");
  const marcas = ["Todas", ...new Set(db.products.map((p) => p.marca))];
  const tallas = ["Todas", ...[...new Set(db.products.map((p) => p.talla))].sort((a, b) => a - b).map(String)];
  const match = (p) => {
    const t = `${p.codigo} ${p.marca} ${p.modelo} ${p.color}`.toLowerCase();
    return t.includes(q.toLowerCase()) && (f.origen === "Todos" || p.origen === f.origen) && (f.talla === "Todas" || String(p.talla) === f.talla) && (f.marca === "Todas" || p.marca === f.marca) && (!f.max || p.precio <= Number(f.max));
  };
  const count = (st) => db.products.filter((p) => p.estado === st).length;
  const list = db.products.filter((p) => p.estado === tab && match(p));
  const TABS = [["Disponible", "Disponibles", Package], ["Reservado", "Reservados", Clock], ["Vendido", "Historial de vendidos", History]];

  const soldRows = db.sales.filter((s) => s.estado === "Activa").flatMap((s) => s.items.map((it) => ({ s, it, p: db.products.find((x) => x.id === it.productId) }))).filter((r) => r.p && match(r.p)).sort((a, b) => b.s.fecha.localeCompare(a.s.fecha) || b.s.id.localeCompare(a.s.id));

  return (
    <div>
      <PageHead title="Inventario" route={tab === "Disponible" ? "/inventario" : tab === "Reservado" ? "/inventario/reservados" : "/inventario/historial"} desc="El catálogo muestra solo lo que se puede vender. Lo reservado y lo vendido tienen su propia pestaña.">
        {can.inv && <Btn onClick={() => setModal({ type: "product" })}><Plus size={15} /> Nuevo par</Btn>}
      </PageHead>

      <div className="flex gap-1 mb-3 overflow-x-auto vx-noscroll border-b border-slate-200 -mx-3 px-3 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-purple-700 text-purple-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            <I size={16} /><span className="sm:hidden">{k === "Vendido" ? "Historial" : l}</span><span className="hidden sm:inline">{l}</span><span className={`text-xs rounded-full px-2 py-0.5 ${tab === k ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"}`}>{count(k)}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className={inputCls + " pl-9"} placeholder="Código, marca, modelo o color" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })} options={["Todos", "Americano", "Coreano"].map((x) => ({ value: x, label: x === "Todos" ? "Todo origen" : x }))} />
          <Select value={f.talla} onChange={(e) => setF({ ...f, talla: e.target.value })} options={tallas.map((t) => ({ value: t, label: t === "Todas" ? "Todas las tallas" : "Talla " + t }))} />
          <Select value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} options={marcas.map((x) => ({ value: x, label: x === "Todas" ? "Todas las marcas" : x }))} />
          <input className={inputCls} type="number" placeholder="Precio máx." value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
        </div>
        {tab !== "Vendido" && (
          <div className="flex bg-slate-100 rounded-lg p-1 self-start">
            <button onClick={() => setView("cards")} className={`p-1.5 rounded-md ${view === "cards" ? "bg-white shadow-sm" : "text-slate-500"}`} aria-label="Ver tarjetas"><LayoutGrid size={16} /></button>
            <button onClick={() => setView("table")} className={`p-1.5 rounded-md ${view === "table" ? "bg-white shadow-sm" : "text-slate-500"}`} aria-label="Ver tabla"><List size={16} /></button>
          </div>
        )}
      </div>

      {tab === "Vendido" ? (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <Stat label="Pares vendidos" value={soldRows.length} tone="slate" icon={History} />
            <Stat label="Vendido" value={bs0(sum(soldRows, (r) => r.it.precio))} tone="lila" />
            <Stat label="Utilidad de esos pares" value={bs0(sum(soldRows, (r) => r.it.precio - r.it.costo))} tone="teal" />
          </div>
          <Panel>
            <Table head={["Código", "Producto", "Talla", "Venta", "Fecha", "Cliente", "Precio vendido", "Costo", "Utilidad", "Vendió", "Pago"]} empty={!soldRows.length && "Todavía no hay pares vendidos con estos filtros."} mobile={soldRows.map(({ s, it, p }) => (
              <MRow key={s.id + p.id} onClick={() => setDrawer(p.id)}>
                <div className="flex gap-3 items-center">
                  <Sneaker hex={p.hex} className="w-14 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.codigo} · {p.marca} {p.modelo}</div>
                    <div className="text-xs text-slate-500 truncate">{client(s.clienteId)?.nombre} · {fdate(s.fecha)} · {userName(s.socio)}</div>
                    <div className="mt-1"><Pill>{payState(db, s)}</Pill></div>
                  </div>
                  <div className="text-right vx-num shrink-0"><div className="text-sm font-semibold">{bs0(it.precio)}</div><div className="text-xs text-cyan-700">+{bs0(it.precio - it.costo)}</div></div>
                </div>
              </MRow>
            ))}>
              {soldRows.map(({ s, it, p }) => (
                <tr key={s.id + p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrawer(p.id)}>
                  <Td className="font-semibold vx-d">{p.codigo}</Td><Td>{p.marca} {p.modelo}<div className="text-xs text-slate-500">{p.color} · {p.origen}</div></Td><Td>{p.talla}</Td>
                  <Td>{s.id}</Td><Td>{fdate(s.fecha)}</Td><Td>{client(s.clienteId)?.nombre}</Td>
                  <Td className="vx-num font-medium">{bs(it.precio)}</Td><Td className="vx-num text-slate-500">{bs(it.costo)}</Td><Td className="vx-num text-cyan-700">{bs(it.precio - it.costo)}</Td>
                  <Td>{userName(s.socio)}</Td><Td><Pill>{payState(db, s)}</Pill></Td>
                </tr>
              ))}
            </Table>
            <p className="text-xs text-slate-500 mt-3">Si una venta se anula, sus pares salen del historial y vuelven a Disponibles.</p>
          </Panel>
        </>
      ) : !list.length ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 py-14 text-center">
          <p className="text-sm text-slate-500">{tab === "Reservado" ? "No hay pares reservados. Las reservas se hacen desde el catálogo de disponibles." : db.products.length ? "No hay pares disponibles con estos filtros." : "Todavía no hay pares cargados. Empieza con “Nuevo par”."}</p>
          {tab === "Reservado" && <Btn variant="outline" className="mt-3" onClick={() => setTab("Disponible")}>Ir a disponibles</Btn>}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {list.map((p) => {
            const r = tab === "Reservado" && db.reservations.find((x) => x.productId === p.id && x.estado === "Activa");
            const h = r ? (new Date(r.vence) - NOW) / 3600000 : 0;
            return (
              <ProductCard key={p.id} p={p} onClick={() => setDrawer(p.id)}>
                {r && (
                  <div className="border-t border-slate-100 p-3 bg-purple-50 space-y-2">
                    <div className="text-xs"><span className="font-semibold text-slate-900">{client(r.clienteId)?.nombre}</span><div className={h < 12 ? "text-rose-600 font-medium" : "text-slate-600"}>Vence en {h > 0 ? `${Math.floor(h)} h` : "0 h (vencida)"}{r.adelanto ? ` · adelanto ${bs0(r.adelanto)}` : ""}</div></div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Btn size="sm" onClick={() => setModal({ type: "sell", productIds: [p.id], reservaIds: [r.id], clienteId: r.clienteId })}>Vender</Btn>
                      <Btn size="sm" variant="danger" onClick={() => { if (confirm("¿Cancelar la reserva? El par vuelve a Disponibles.")) actions.cancelReservation(r.id); }}>Cancelar</Btn>
                    </div>
                  </div>
                )}
              </ProductCard>
            );
          })}
        </div>
      ) : (
        <Panel>
          <Table head={tab === "Reservado" ? ["Código", "Producto", "Talla", "Cliente", "Vence", "Adelanto", "Precio", ""] : ["Código", "Producto", "Talla", "Origen", "Lote", "Costo", "Precio", "Margen", "Días en stock"]}>
            {list.map((p) => {
              const r = tab === "Reservado" && db.reservations.find((x) => x.productId === p.id && x.estado === "Activa");
              return tab === "Reservado" ? (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-semibold vx-d">{p.codigo}</Td><Td>{p.marca} {p.modelo}</Td><Td>{p.talla}</Td><Td>{client(r?.clienteId)?.nombre}</Td><Td>{r ? ftime(r.vence) : "—"}</Td><Td className="vx-num">{r?.adelanto ? bs(r.adelanto) : "—"}</Td><Td className="vx-num">{bs(p.precio)}</Td>
                  <Td>{r && <div className="flex gap-1.5"><Btn size="sm" onClick={() => setModal({ type: "sell", productIds: [p.id], reservaIds: [r.id], clienteId: r.clienteId })}>Vender</Btn><Btn size="sm" variant="danger" onClick={() => { if (confirm("¿Cancelar la reserva? El par vuelve a Disponibles.")) actions.cancelReservation(r.id); }}>Cancelar</Btn></div>}</Td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrawer(p.id)}>
                  <Td className="font-semibold vx-d">{p.codigo}</Td><Td>{p.marca} {p.modelo}<div className="text-xs text-slate-500">{p.color}</div></Td>
                  <Td>{p.talla}</Td><Td><Pill>{p.origen}</Pill></Td><Td>{p.lote}</Td><Td className="vx-num">{bs(pCost(p))}</Td>
                  <Td className="vx-num font-medium">{bs(p.precio)}</Td><Td className="vx-num text-cyan-700">{bs(p.precio - pCost(p))}</Td><Td className="vx-num">{diffDays(p.fechaIngreso, TODAY)}</Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}
    </div>
  );
}

export function ProductDrawer({ db, id, onClose, setModal, actions, userName, client, can }) {
  const p = db.products.find((x) => x.id === id);
  const [photo, setPhoto] = useState(0);
  const [busy, run] = useBusy();
  const fileRef = useRef(null);
  if (!p) return null;
  const lot = db.lots.find((l) => l.id === p.lote) || { id: p.lote, nombre: "" };
  const res = db.reservations.find((r) => r.productId === p.id && r.estado === "Activa");
  const sale = db.sales.find((s) => s.estado === "Activa" && s.items.some((i) => i.productId === p.id));
  const hist = db.audit.filter((a) => a.entidad === p.codigo);
  const margin = p.precio - pCost(p);
  const cur = Math.min(photo, Math.max(0, p.photos.length - 1));
  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) run(async () => { await actions.addPhotos(p.id, files); setPhoto(p.photos.length); });
  };
  return (
    <div className="fixed inset-0 z-40 bg-slate-900 bg-opacity-40 flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-white overflow-y-auto vx-safe-b" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 h-14 border-b border-slate-100">
          <div className="flex items-center gap-2"><span className="vx-d font-bold text-lg">{p.codigo}</span><Pill>{p.estado}</Pill></div>
          <div className="flex items-center gap-1">
            {can.inv && p.estado !== "Vendido" && <Btn size="sm" variant="outline" onClick={() => { onClose(); setModal({ type: "product", edit: p }); }}><Pencil size={13} /> Editar</Btn>}
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="relative aspect-video rounded-xl vx-photo overflow-hidden">
              <ProductPhoto p={p} idx={cur} />
              {can.inv && p.photos[cur] && (
                <button className="absolute top-2 right-2 p-1.5 rounded-lg bg-white text-rose-600 shadow" aria-label="Eliminar esta foto" disabled={busy}
                  onClick={() => { if (confirm("¿Eliminar esta foto?")) run(async () => { await actions.deletePhoto(p.photos[cur], p.codigo); setPhoto(0); }); }}><Trash2 size={15} /></button>
              )}
              {busy && <div className="absolute inset-0 bg-white bg-opacity-70 grid place-items-center text-sm text-slate-600"><span className="flex items-center gap-2"><Spinner /> Subiendo…</span></div>}
            </div>
            <div className="flex gap-2 mt-2 overflow-x-auto vx-noscroll">
              {p.photos.map((f, i) => (
                <button key={f.id} onClick={() => setPhoto(i)} className={`w-16 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${cur === i ? "border-cyan-500" : "border-transparent"}`} aria-label={`Foto ${i + 1}`}>
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
              {can.inv && (
                <>
                  <button disabled={busy} onClick={() => fileRef.current?.click()} className="w-16 h-12 shrink-0 rounded-lg border border-dashed border-slate-300 grid place-items-center text-slate-500 hover:border-cyan-500" aria-label="Agregar fotos"><ImagePlus size={18} /></button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
                </>
              )}
            </div>
          </div>
          <div>
            <h2 className="vx-d text-xl font-bold">{p.marca} {p.modelo}</h2>
            {p.descripcion && <p className="text-sm text-slate-500">{p.descripcion}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[["Talla", p.talla], ["Color", p.color], ["Origen", p.origen], ["Categoría", p.categoria], ["Estado físico", p.estadoFisico], ["Lote", `${lot.id} · ${lot.nombre}`], ["Ingreso", fdate(p.fechaIngreso)], ["Registró", userName(p.socio)]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          {p.obs && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{p.obs}</p>}
          {can.admin && (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
              {[["Costo de compra", bs(p.costoCompra)], ["Transporte y otros (proporcional)", bs(p.costoTransporte)], ["Costo total del par", bs(pCost(p))], ["Precio de venta", bs(p.precio)]].map(([k, v], i) => (
                <div key={k} className={`flex justify-between px-3 py-2 ${i === 2 ? "font-semibold" : ""}`}><span className="text-slate-600">{k}</span><span className="vx-num">{v}</span></div>
              ))}
              <div className="flex justify-between px-3 py-2 bg-cyan-50 text-cyan-800 font-semibold"><span>Utilidad estimada</span><span className="vx-num">{bs(margin)} ({p.precio ? Math.round((margin / p.precio) * 100) : 0}%)</span></div>
            </div>
          )}
          {!can.admin && <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-600">Precio de venta</span><span className="vx-num font-semibold">{bs(p.precio)}</span></div>}
          {res && <div className="rounded-xl bg-purple-50 p-3 text-sm"><div className="font-medium text-purple-900">Reservado para {client(res.clienteId)?.nombre}</div><div className="text-xs text-purple-700 mt-0.5">{res.id} · por {userName(res.socio)} · vence {ftime(res.vence)}{res.adelanto ? ` · adelanto ${bs(res.adelanto)}` : ""}</div></div>}
          {sale && <div className="rounded-xl bg-slate-100 p-3 text-sm"><div className="font-medium">Vendido en {sale.id}</div><div className="text-xs text-slate-600 mt-0.5">{client(sale.clienteId)?.nombre} · {fdate(sale.fecha)} · {userName(sale.socio)} · {sale.canal}</div></div>}
          {can.sell && (
            <div className="grid grid-cols-2 gap-2">
              {p.estado === "Disponible" && <>
                <Btn variant="lila" onClick={() => { onClose(); setModal({ type: "reserve", productId: p.id }); }}><Clock size={15} /> Reservar</Btn>
                <Btn onClick={() => { onClose(); setModal({ type: "sell", productIds: [p.id] }); }}><ShoppingBag size={15} /> Vender</Btn>
              </>}
              {p.estado === "Reservado" && res && <>
                <Btn onClick={() => { onClose(); setModal({ type: "sell", productIds: [p.id], reservaIds: [res.id], clienteId: res.clienteId }); }}>Convertir en venta</Btn>
                <Btn variant="danger" onClick={() => { if (confirm("¿Cancelar la reserva? El par vuelve a Disponibles.")) { actions.cancelReservation(res.id); onClose(); } }}><Ban size={15} /> Cancelar reserva</Btn>
              </>}
            </div>
          )}
          {can.admin && p.estado === "Disponible" && (
            <button className="text-xs text-rose-600 underline" onClick={() => { if (confirm(`¿Eliminar ${p.codigo} del inventario? Solo es posible si nunca se reservó ni vendió.`)) actions.deleteProduct(p).then((ok) => ok && onClose()); }}>Eliminar este par (cargado por error)</button>
          )}
          {can.admin && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Historial del par</h3>
              {hist.length ? <ul className="space-y-2">{hist.map((a) => <li key={a.id} className="text-xs border-l-2 border-cyan-300 pl-3"><span className="font-medium">{a.accion}</span> · {userName(a.user)} · {ftime(a.ts)}<div className="text-slate-500">{a.detalle}</div></li>)}</ul> : <p className="text-xs text-slate-400">Las acciones sobre este par aparecerán aquí.</p>}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function ProductModal({ db, onClose, actions, edit = null }) {
  const ultimoLote = db.lots[db.lots.length - 1];
  const [p, setP] = useState(edit
    ? { lote: edit.lote, marca: edit.marca, modelo: edit.modelo, origen: edit.origen, categoria: edit.categoria, talla: edit.talla, color: edit.color, estadoFisico: edit.estadoFisico, precio: edit.precio, descripcion: edit.descripcion, obs: edit.obs }
    : { lote: ultimoLote?.id || "", marca: "", modelo: "", origen: "Americano", categoria: "Hombre", talla: 41, color: "Blanco", estadoFisico: "Excelente", precio: "", descripcion: "", obs: "" });
  const [files, setFiles] = useState([]);
  const [busy, run] = useBusy();
  const fileRef = useRef(null);
  const lot = db.lots.find((l) => l.id === p.lote);
  const cost = edit ? pCost(edit) : lot ? lotTotal(lot) / lot.pares : 0;
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const colores = [...new Set([...COLORS.map((c) => c[0]), p.color].filter(Boolean))];
  const ok = p.lote && p.marca.trim() && String(p.talla).trim() && Number(p.precio) >= 0 && String(p.precio) !== "";
  if (!db.lots.length) {
    return (
      <Modal title="Nuevo par" onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}>
        <p className="text-sm text-slate-600">Primero registra un lote en Compras y lotes: el costo de cada par sale de su lote.</p>
      </Modal>
    );
  }
  return (
    <Modal wide title={edit ? `Editar ${edit.codigo}` : "Nuevo par"} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !ok} onClick={() => run(async () => { if (await actions.saveProduct(p, files, edit?.id || null)) onClose(); })}>{busy ? <Spinner /> : null} {edit ? "Guardar cambios" : "Agregar al inventario"}</Btn></>}>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} className="w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-cyan-500 grid place-items-center text-center text-xs text-slate-500 p-3 overflow-hidden">
            {previews.length ? <img src={previews[0]} alt="" className="w-full h-full object-cover rounded-lg" /> : <div><Camera size={24} className="mx-auto mb-1 text-slate-400" />{edit ? "Agregar más fotos" : "Toma o elige fotos"}<br />JPG, PNG o WEBP</div>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const nf = Array.from(e.target.files || []); e.target.value = ""; setFiles([...files, ...nf].slice(0, 8)); }} />
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {previews.map((u, i) => (
                <div key={u} className="relative w-12 h-12 rounded-md overflow-hidden">
                  <img src={u} alt="" className="w-full h-full object-cover" />
                  <button type="button" className="absolute top-0 right-0 bg-white rounded-bl p-0.5 text-rose-600" aria-label="Quitar foto" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">Hasta 8 fotos. Se reducen solas para que suban rápido.</p>
        </div>
        <div className="sm:col-span-2 grid grid-cols-2 gap-3">
          <Field label="Lote"><Select value={p.lote} disabled={!!edit && edit.estado === "Vendido"} onChange={(e) => setP({ ...p, lote: e.target.value })} options={db.lots.map((l) => ({ value: l.id, label: `${l.id} · ${l.nombre}` }))} /></Field>
          <Field label="Origen"><Select value={p.origen} onChange={(e) => setP({ ...p, origen: e.target.value })} options={["Americano", "Coreano"]} /></Field>
          <Field label="Marca">
            <input className={inputCls} list="vx-marcas" value={p.marca} onChange={(e) => setP({ ...p, marca: e.target.value })} />
            <datalist id="vx-marcas">{[...new Set([...MARCAS, ...db.products.map((x) => x.marca)])].map((mk) => <option key={mk} value={mk} />)}</datalist>
          </Field>
          <Field label="Modelo"><Input value={p.modelo} onChange={(e) => setP({ ...p, modelo: e.target.value })} /></Field>
          <Field label="Talla"><Input type="number" step="0.5" inputMode="decimal" value={p.talla} onChange={(e) => setP({ ...p, talla: e.target.value })} /></Field>
          <Field label="Color"><Select value={p.color} onChange={(e) => setP({ ...p, color: e.target.value })} options={colores} /></Field>
          <Field label="Categoría"><Select value={p.categoria} onChange={(e) => setP({ ...p, categoria: e.target.value })} options={[...new Set(["Hombre", "Mujer", "Unisex", "Niño", p.categoria])]} /></Field>
          <Field label="Estado físico"><Select value={p.estadoFisico} onChange={(e) => setP({ ...p, estadoFisico: e.target.value })} options={[...new Set(["Excelente", "Muy bueno", "Bueno", p.estadoFisico])]} /></Field>
        </div>
      </div>
      <Field label="Descripción"><Input value={p.descripcion} placeholder="Ej.: poco desgaste, suela en buen estado" onChange={(e) => setP({ ...p, descripcion: e.target.value })} /></Field>
      <Field label="Observaciones internas"><Input value={p.obs} onChange={(e) => setP({ ...p, obs: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3 items-end">
        <Field label="Costo del par (del lote)"><div className="rounded-lg bg-slate-100 px-3 py-2 text-sm vx-num">{bs(cost)}</div></Field>
        <Field label="Precio de venta"><Input type="number" inputMode="decimal" value={p.precio} onChange={(e) => setP({ ...p, precio: e.target.value })} /></Field>
        <Field label="Utilidad estimada"><div className="rounded-lg bg-cyan-50 text-cyan-800 px-3 py-2 text-sm vx-num">{bs((Number(p.precio) || 0) - cost)}</div></Field>
      </div>
      {!edit && <p className="text-xs text-slate-500">El código (V001, V002…) se asigna solo al guardar.</p>}
    </Modal>
  );
}
