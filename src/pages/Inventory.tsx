import { useState, useMemo, useEffect, useRef } from "react";
import { LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, X, Menu, Bell, LogOut, LayoutGrid, List, Clock, CheckCircle2, AlertTriangle, Boxes, Receipt, History, Camera, Phone, MapPin, Lock, Download, FileText, Layers, UserPlus, CreditCard, Ban, Upload, ChevronRight, Eye, EyeOff, Building2, CalendarDays, BellRing, ChevronLeft, Pencil, Trash2, MoreHorizontal, KeyRound, Printer, RefreshCw, ImagePlus, UserCog, Star, Share2, ArrowLeft, ArrowRight, ZoomIn, Gift, QrCode, CheckSquare, Play, Video, Crop } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, pad2, isoLocal, NOW, TODAY, tick, addDays, diffDays, bs, bs0, fdate, sum, ftime, COLORS, ESTADOS_PEDIDO, DEPARTAMENTOS, TIPOS_EVENTO, RECORDATORIOS, MESES, DIAS, DIAS_LARGO, evDate, fechaLarga, recLabel, agendaEvents, reminderState, TIPOS_ENTREGA, GASTO_CATS, saleTotal, saleCost, paidOf, payState, lotTotal, pCost, computeMetrics, MARCAS, colorHex, ROLES, ACCESO, permisos, exportarCSV, fcm, itemLista } from "../lib/utils";
import { FORMATOS, ENCUADRE_INICIAL, cargarFoto, dibujarImagen, lienzoABlob, descargarBlob } from "../lib/postImage";
import { PhotoPicker, PhotoViewer } from "../components/photos";
import { CropModal, RecortarVarias } from "../components/recorte";
import { VideoPicker, VideoThumb, VideoPlayer } from "../components/videos";
import { Isotipo, Logo, Sneaker, Btn, PILL, Pill, Panel, Field, inputCls, Input, Select, Modal, Stat, PageHead, MRow, Table, Td, Note, ProductPhoto, useBusy, Spinner, PasswordInput } from "../components/ui";

export function ProductCard({ p, onClick, children, selected = undefined, onZoom = null }) {
  const selecting = selected !== undefined;
  const verFotos = !selecting && onZoom && p.photos && p.photos.length > 0;
  return (
    <div className={`relative bg-white rounded-xl border overflow-hidden transition-colors flex flex-col ${selected ? "border-purple-600 ring-2 ring-purple-600" : "border-slate-200 hover:border-cyan-400"}`}>
      <button onClick={onClick} className="text-left flex-1" aria-pressed={selecting ? selected : undefined}>
        <div className="relative aspect-square vx-photo overflow-hidden">
          <ProductPhoto p={p} />
          {selecting && (
            <span className={`absolute bottom-2 left-2 w-6 h-6 rounded-full grid place-items-center border-2 ${selected ? "bg-purple-700 border-purple-700 text-white" : "bg-white border-slate-300"}`} aria-hidden="true">
              {selected && <CheckCircle2 size={14} />}
            </span>
          )}
          <span className="absolute top-2 left-2 vx-d text-xs font-bold bg-white rounded-md px-1.5 py-0.5 text-slate-900">{p.codigo}</span>
          <span className="absolute top-2 right-2"><Pill>{p.estado}</Pill></span>
          {!verFotos && <span className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-slate-500 bg-white rounded px-1.5"><Camera size={11} />{p.fotos}</span>}
          {p.videos?.length > 0 && <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs font-semibold text-white bg-slate-900/75 rounded px-1.5 py-0.5" title="Tiene video"><Play size={10} className="fill-white" />{p.videos.length > 1 ? p.videos.length : "Video"}</span>}
        </div>
        <div className="p-3">
          <div className="text-sm font-semibold text-slate-900 truncate">{p.marca} {p.modelo}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">Talla {p.talla}{p.cm ? ` · ${fcm(p.cm)}` : ""} · {p.color} · {p.origen === "Americano" ? "US" : "KR"}</div>
          <div className="flex items-end justify-between mt-2">
            <span className="vx-d vx-num text-base font-bold text-slate-900 flex items-center gap-1.5">{bs0(p.precio)}{p.qrId && <span title="Tiene QR de pago" className="text-purple-700"><QrCode size={14} aria-label="Tiene QR de pago" /></span>}</span>
            <span className="text-xs text-cyan-700 vx-num">+{bs0(p.precio - pCost(p))}</span>
          </div>
        </div>
      </button>
      {verFotos && (
        <div className="absolute inset-x-0 top-0 aspect-square pointer-events-none">
          <button onClick={onZoom} className="pointer-events-auto absolute bottom-2 right-2 flex items-center gap-1 text-xs font-semibold text-slate-800 bg-white rounded-md px-2 py-1 shadow" aria-label={`Ver las fotos de ${p.codigo} completas`}>
            <ZoomIn size={13} /> Ver {p.photos.length > 1 ? `${p.photos.length} fotos` : "foto"}
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

export function Inventory({ db, setDrawer, setModal, toast, actions, client, userName, can }) {
  const [tab, setTab] = useState("Disponible");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ origen: "Todos", talla: "Todas", marca: "Todas", max: "" });
  const [view, setView] = useState("cards");
  const [selecting, setSelecting] = useState(false);
  const [visor, setVisor] = useState(null);
  const [sel, setSel] = useState(new Set());
  const marcas = ["Todas", ...new Set(db.products.map((p) => p.marca))];
  const tallas = ["Todas", ...[...new Set(db.products.map((p) => p.talla))].sort((a, b) => a - b).map(String)];
  const match = (p) => {
    const t = `${p.codigo} ${p.marca} ${p.modelo} ${p.color}`.toLowerCase();
    return t.includes(q.toLowerCase()) && (f.origen === "Todos" || p.origen === f.origen) && (f.talla === "Todas" || String(p.talla) === f.talla) && (f.marca === "Todas" || p.marca === f.marca) && (!f.max || p.precio <= Number(f.max));
  };
  const count = (st) => db.products.filter((p) => p.estado === st).length;
  const list = db.products.filter((p) => p.estado === tab && match(p));
  const TABS = [["Disponible", "Disponibles", Package], ["Reservado", "Reservados", Clock], ["Vendido", "Historial de vendidos", History]];
  if (can.admin && (count("Eliminado") > 0 || tab === "Eliminado")) TABS.push(["Eliminado", "Eliminados", Trash2]);
  const cambiarTab = (k) => { setTab(k); setSelecting(false); setSel(new Set()); };
  const visibles = list.map((p) => p.id);
  const elegidos = visibles.filter((id) => sel.has(id));
  const todos = visibles.length > 0 && elegidos.length === visibles.length;
  const alternar = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const terminarSeleccion = () => { setSelecting(false); setSel(new Set()); };
  const eliminados = db.products.filter((p) => p.estado === "Eliminado" && match(p)).sort((a, b) => String(b.bajaEn || "").localeCompare(String(a.bajaEn || "")));

  const soldRows = db.sales.filter((s) => s.estado === "Activa").flatMap((s) => s.items.map((it) => ({ s, it, p: db.products.find((x) => x.id === it.productId) }))).filter((r) => r.p && match(r.p)).sort((a, b) => b.s.fecha.localeCompare(a.s.fecha) || b.s.id.localeCompare(a.s.id));

  return (
    <div>
      <PageHead title="Inventario" route={tab === "Disponible" ? "/inventario" : tab === "Reservado" ? "/inventario/reservados" : "/inventario/historial"} desc="El catálogo muestra solo lo que se puede vender. Lo reservado y lo vendido tienen su propia pestaña.">
        {can.inv && !selecting && <Btn variant="outline" onClick={() => setModal({ type: "qrManager" })}><QrCode size={15} /> QR de pago</Btn>}
        {(can.admin || can.inv) && tab === "Disponible" && list.length > 0 && (
          selecting
            ? <Btn variant="outline" onClick={terminarSeleccion}><X size={15} /> Cancelar selección</Btn>
            : <Btn variant="outline" onClick={() => setSelecting(true)}><CheckSquare size={15} /> Seleccionar varios</Btn>
        )}
        {can.inv && !selecting && <Btn onClick={() => setModal({ type: "product" })}><Plus size={15} /> Nuevo par</Btn>}
      </PageHead>
      {selecting && <div className="mb-3"><Note>Toca los pares que quieras y luego elige abajo qué hacer: {can.inv ? <><b>Asignar QR</b> (por ejemplo, a todos los de un mismo precio)</> : null}{can.inv && can.admin ? " o " : ""}{can.admin ? <b>Eliminar</b> : null}.</Note></div>}

      <div className="flex gap-1 mb-3 overflow-x-auto vx-noscroll border-b border-slate-200 -mx-3 px-3 sm:mx-0 sm:px-0" role="tablist">
        {TABS.map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => cambiarTab(k)} className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-purple-700 text-purple-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
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
        {tab !== "Vendido" && tab !== "Eliminado" && (
          <div className="flex bg-slate-100 rounded-lg p-1 self-start">
            <button onClick={() => setView("cards")} className={`p-1.5 rounded-md ${view === "cards" ? "bg-white shadow-sm" : "text-slate-500"}`} aria-label="Ver tarjetas"><LayoutGrid size={16} /></button>
            <button onClick={() => setView("table")} className={`p-1.5 rounded-md ${view === "table" ? "bg-white shadow-sm" : "text-slate-500"}`} aria-label="Ver tabla"><List size={16} /></button>
          </div>
        )}
      </div>

      {tab === "Eliminado" ? (
        <Panel title="Pares eliminados" sub="Salieron del inventario, pero se conserva su historial. Puedes devolverlos a Disponibles.">
          <Table head={["Código", "Producto", "Talla", "Motivo", "Fecha", "Eliminó", "Costo", ""]} empty={!eliminados.length && "No hay pares eliminados con estos filtros."} mobile={eliminados.map((p) => (
            <MRow key={p.id}>
              <div className="flex gap-3 items-center">
                <button onClick={() => setDrawer(p.id)} className="w-14 h-12 shrink-0 rounded-lg overflow-hidden vx-photo" aria-label={`Ver ${p.codigo}`}><ProductPhoto p={p} /></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.codigo} · {p.marca} {p.modelo}</div>
                  <div className="text-xs text-rose-700 truncate">{p.bajaMotivo || "Sin motivo"}</div>
                  <div className="text-xs text-slate-500">{p.bajaEn ? fdate(String(p.bajaEn).slice(0, 10)) : ""} · {userName(p.bajaPor)}</div>
                </div>
                <Btn size="sm" variant="outline" onClick={() => { if (confirm(`¿Devolver ${p.codigo} a Disponibles?`)) actions.restoreProduct(p); }}><RefreshCw size={13} /> Restaurar</Btn>
              </div>
            </MRow>
          ))}>
            {eliminados.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="font-semibold vx-d"><button className="underline-offset-2 hover:underline" onClick={() => setDrawer(p.id)}>{p.codigo}</button></Td>
                <Td>{p.marca} {p.modelo}<div className="text-xs text-slate-500">{p.color}</div></Td><Td>{p.talla}</Td>
                <Td className="text-rose-700">{p.bajaMotivo || "Sin motivo"}</Td><Td>{p.bajaEn ? fdate(String(p.bajaEn).slice(0, 10)) : "—"}</Td><Td>{userName(p.bajaPor)}</Td>
                <Td className="vx-num">{bs(pCost(p))}</Td>
                <Td><Btn size="sm" variant="outline" onClick={() => { if (confirm(`¿Devolver ${p.codigo} a Disponibles?`)) actions.restoreProduct(p); }}><RefreshCw size={13} /> Restaurar</Btn></Td>
              </tr>
            ))}
          </Table>
          <p className="text-xs text-slate-500 mt-3">El costo de los pares dados de baja por daño, pérdida u otro motivo se descuenta de la ganancia neta. Los cargados por error no cuentan como pérdida.</p>
        </Panel>
      ) : tab === "Vendido" ? (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <Stat label="Pares vendidos" value={soldRows.length} sub={soldRows.some((r) => r.s.regalo) ? `${soldRows.filter((r) => r.s.regalo).length} fueron regalo` : null} tone="slate" icon={History} />
            <Stat label="Vendido" value={bs0(sum(soldRows, (r) => r.it.precio))} tone="lila" />
            <Stat label="Utilidad de esos pares" value={bs0(sum(soldRows, (r) => r.it.precio - r.it.costo))} tone="teal" />
          </div>
          <Panel>
            <Table head={["Código", "Producto", "Talla", "Venta", "Fecha", "Cliente", "Canal", "Precio vendido", "Costo", "Utilidad", "Pago", "Entrega", ""]} empty={!soldRows.length && "Todavía no hay pares vendidos con estos filtros."} mobile={soldRows.map(({ s, it, p }) => (
              <MRow key={s.id + p.id}>
                <button className="w-full text-left flex gap-3 items-center" onClick={() => setDrawer(p.id)} aria-label={`Ver ${p.codigo}`}>
                  <div className="w-14 h-11 rounded-md overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.codigo} · {p.marca} {p.modelo}</div>
                    <div className="text-xs text-slate-500 truncate">{client(s.clienteId)?.nombre} · {fdate(s.fecha)} · {s.canal}</div>
                    <div className="mt-1 flex flex-wrap gap-1"><Pill>{payState(db, s)}</Pill><Pill tone={s.pedido === "Entregado" ? "Pagado" : "Pendiente"}>{s.pedido === "Entregado" ? "Entregado" : s.pedido}</Pill></div>
                  </div>
                  <div className="text-right vx-num shrink-0">
                    {s.regalo ? <div className="text-sm font-semibold text-amber-700 flex items-center gap-1 justify-end"><Gift size={13} /> {bs0(itemLista(db, it))}</div> : <div className="text-sm font-semibold">{bs0(it.precio)}</div>}
                    <div className={`text-xs ${it.precio - it.costo < 0 ? "text-rose-600" : "text-cyan-700"}`}>{it.precio - it.costo < 0 ? "−" : "+"}{bs0(Math.abs(it.precio - it.costo))}</div>
                  </div>
                </button>
                {can.admin && s.estado === "Activa" && <Btn size="sm" variant="outline" className="w-full mt-2" onClick={() => setModal({ type: "editSale", ventaId: s.id })}><Pencil size={13} /> Modificar (regalo, entrega, precio)</Btn>}
              </MRow>
            ))}>
              {soldRows.map(({ s, it, p }) => (
                <tr key={s.id + p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrawer(p.id)}>
                  <Td className="font-semibold vx-d">{p.codigo}</Td><Td>{p.marca} {p.modelo}<div className="text-xs text-slate-500">{p.color} · {p.origen}</div></Td><Td>{p.talla}</Td>
                  <Td>{s.id}</Td><Td>{fdate(s.fecha)}</Td><Td>{client(s.clienteId)?.nombre}</Td><Td>{s.canal}</Td>
                  <Td className="vx-num font-medium">{s.regalo ? <span className="text-amber-700 flex items-center gap-1"><Gift size={13} /> Bs 0 <span className="text-xs font-normal">(valía {bs0(itemLista(db, it))})</span></span> : bs(it.precio)}</Td>
                  <Td className="vx-num text-slate-500">{bs(it.costo)}</Td><Td className={`vx-num ${it.precio - it.costo < 0 ? "text-rose-600" : "text-cyan-700"}`}>{bs(it.precio - it.costo)}</Td>
                  <Td><Pill>{payState(db, s)}</Pill></Td>
                  <Td><Pill tone={s.pedido === "Entregado" ? "Pagado" : "Pendiente"}>{s.pedido}</Pill></Td>
                  <Td>{can.admin && s.estado === "Activa" && <Btn size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setModal({ type: "editSale", ventaId: s.id }); }}><Pencil size={13} /> Modificar</Btn>}</Td>
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
              <ProductCard key={p.id} p={p} onZoom={() => setVisor(p)} selected={selecting ? sel.has(p.id) : undefined} onClick={() => (selecting ? alternar(p.id) : setDrawer(p.id))}>
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
          <Table head={tab === "Reservado" ? ["Código", "Producto", "Talla", "Cliente", "Vence", "Adelanto", "Precio", ""] : [...(selecting ? [<input key="todos" type="checkbox" className="w-4 h-4 accent-purple-700" aria-label="Seleccionar todos" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(visibles))} />] : []), "Código", "Producto", "Talla", "Origen", "Lote", "Costo", "Precio", "Margen", "Días en stock"]}>
            {list.map((p) => {
              const r = tab === "Reservado" && db.reservations.find((x) => x.productId === p.id && x.estado === "Activa");
              return tab === "Reservado" ? (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-semibold vx-d">{p.codigo}</Td><Td>{p.marca} {p.modelo}</Td><Td>{p.talla}</Td><Td>{client(r?.clienteId)?.nombre}</Td><Td>{r ? ftime(r.vence) : "—"}</Td><Td className="vx-num">{r?.adelanto ? bs(r.adelanto) : "—"}</Td><Td className="vx-num">{bs(p.precio)}</Td>
                  <Td>{r && <div className="flex gap-1.5"><Btn size="sm" onClick={() => setModal({ type: "sell", productIds: [p.id], reservaIds: [r.id], clienteId: r.clienteId })}>Vender</Btn><Btn size="sm" variant="danger" onClick={() => { if (confirm("¿Cancelar la reserva? El par vuelve a Disponibles.")) actions.cancelReservation(r.id); }}>Cancelar</Btn></div>}</Td>
                </tr>
              ) : (
                <tr key={p.id} className={`cursor-pointer ${selecting && sel.has(p.id) ? "bg-purple-50" : "hover:bg-slate-50"}`} onClick={() => (selecting ? alternar(p.id) : setDrawer(p.id))}>
                  {selecting && <Td><input type="checkbox" className="w-4 h-4 accent-purple-700" aria-label={`Seleccionar ${p.codigo}`} checked={sel.has(p.id)} onChange={() => alternar(p.id)} onClick={(e) => e.stopPropagation()} /></Td>}
                  <Td className="font-semibold vx-d"><span className="inline-flex items-center gap-1">{p.codigo}{p.qrId && <QrCode size={13} className="text-purple-700" aria-label="Tiene QR de pago" />}</span></Td><Td>{p.marca} {p.modelo}<div className="text-xs text-slate-500">{p.color}</div></Td>
                  <Td>{p.talla}{p.cm ? <span className="text-xs text-slate-500"> · {fcm(p.cm)}</span> : null}</Td><Td><Pill>{p.origen}</Pill></Td><Td>{p.lote}</Td><Td className="vx-num">{bs(pCost(p))}</Td>
                  <Td className="vx-num font-medium">{bs(p.precio)}</Td><Td className="vx-num text-cyan-700">{bs(p.precio - pCost(p))}</Td><Td className="vx-num">{diffDays(p.fechaIngreso, TODAY)}</Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}

      {visor && <PhotoViewer urls={visor.photos.map((f) => f.url)} title={`${visor.codigo} · ${visor.marca} ${visor.modelo}`} onClose={() => setVisor(null)} />}
      {selecting && (
        <>
          <div className="h-20" aria-hidden="true" />
          <div className="fixed z-30 left-3 right-3 bottom-20 lg:bottom-4 lg:left-72 lg:right-6 bg-slate-900 text-white rounded-xl shadow-xl px-4 py-3 flex flex-wrap items-center gap-2" role="region" aria-label="Pares seleccionados">
            <span className="text-sm font-semibold flex-1 min-w-max">{elegidos.length} {elegidos.length === 1 ? "par seleccionado" : "pares seleccionados"}</span>
            <button className="text-sm px-3 py-1.5 rounded-lg hover:bg-slate-700" onClick={() => setSel(todos ? new Set() : new Set(visibles))}>{todos ? "Quitar todos" : `Seleccionar los ${visibles.length}`}</button>
            {can.inv && <button disabled={!elegidos.length} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 flex items-center gap-1.5"
              onClick={() => setModal({ type: "qrAssign", ids: elegidos, onDone: terminarSeleccion })}><QrCode size={15} /> Asignar QR</button>}
            {can.admin && <button disabled={!elegidos.length} className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 flex items-center gap-1.5"
              onClick={() => setModal({ type: "deleteProducts", ids: elegidos, onDone: terminarSeleccion })}><Trash2 size={15} /> Eliminar</button>}
            <button className="p-1.5 rounded-lg hover:bg-slate-700" aria-label="Cancelar selección" onClick={terminarSeleccion}><X size={17} /></button>
          </div>
        </>
      )}
    </div>
  );
}

/** Confirmación para eliminar uno o varios pares */
export function DeleteProductsModal({ db, ids, onClose, onDone, actions }) {
  const MOTIVOS = ["Cargado por error", "Dañado / no se puede vender", "Perdido o robado", "Regalado o uso personal", "Otro"];
  const ps = (ids || []).map((id) => db.products.find((p) => p.id === id)).filter(Boolean);
  const disponibles = ps.filter((p) => p.estado === "Disponible");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [nota, setNota] = useState("");
  const [busy, run] = useBusy();
  const conHistorial = disponibles.filter((p) => db.reservations.some((r) => r.productId === p.id) || db.sales.some((s) => s.items.some((i) => i.productId === p.id)));
  const error = motivo === MOTIVOS[0];
  const costo = sum(disponibles, pCost);
  const n = disponibles.length;
  return (
    <Modal title={n === 1 ? `Eliminar ${disponibles[0].codigo}` : `Eliminar ${n} pares`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      <Btn variant="danger" disabled={busy || !n || (motivo === "Otro" && !nota.trim())}
        onClick={() => run(async () => { if (await actions.deleteProducts(disponibles.map((p) => p.id), motivo, nota.trim())) { if (onDone) onDone(); onClose(); } })}>
        {busy ? <Spinner /> : <Trash2 size={15} />} {n === 1 ? "Eliminar par" : `Eliminar ${n} pares`}
      </Btn>
    </>}>
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
        {disponibles.map((p) => <span key={p.id} className="text-xs font-semibold bg-slate-100 rounded-md px-2 py-1">{p.codigo} · {p.marca} {p.modelo} T{p.talla}</span>)}
      </div>
      {ps.length > n && <p className="text-xs text-amber-700">{ps.length - n} par(es) ya no están disponibles y no se eliminarán.</p>}
      <Field label="Motivo">
        <Select value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS} />
      </Field>
      <Field label={motivo === "Otro" ? "Explica el motivo" : "Nota (opcional)"}>
        <Input value={nota} placeholder="Ej.: suela despegada, se registró dos veces" onChange={(e) => setNota(e.target.value)} />
      </Field>
      <div className={`rounded-xl p-3 text-sm ${error ? "bg-slate-50 text-slate-700" : "bg-rose-50 text-rose-800"}`}>
        {error ? (
          <>
            <p>Se borran por completo, junto con sus fotos.</p>
            {conHistorial.length > 0 && <p className="mt-1">Excepto {conHistorial.map((p) => p.codigo).join(", ")}: tienen reservas o ventas anteriores, así que se dan de baja y su historial se conserva.</p>}
          </>
        ) : (
          <p>Salen del inventario y quedan en la pestaña <b>Eliminados</b> con este motivo. Su costo ({bs(costo)}) se descuenta de la ganancia neta como pérdida. Si fue un error, puedes restaurarlos.</p>
        )}
      </div>
    </Modal>
  );
}

export function ProductDrawer({ db, id, onClose, setModal, actions, userName, client, can }) {
  const p = db.products.find((x) => x.id === id);
  const [photo, setPhoto] = useState(0);
  const [visor, setVisor] = useState(false);
  const [busy, run] = useBusy();
  if (!p) return null;
  const lot = db.lots.find((l) => l.id === p.lote) || { id: p.lote, nombre: "" };
  const res = db.reservations.find((r) => r.productId === p.id && r.estado === "Activa");
  const sale = db.sales.find((s) => s.estado === "Activa" && s.items.some((i) => i.productId === p.id));
  const hist = db.audit.filter((a) => a.entidad === p.codigo);
  const margin = p.precio - pCost(p);
  const cur = Math.min(photo, Math.max(0, p.photos.length - 1));
  const mover = (de, a) => {
    const ids = p.photos.map((f) => f.id);
    const [x] = ids.splice(de, 1);
    ids.splice(a, 0, x);
    run(async () => { if (await actions.reorderPhotos(p.id, ids, a === 0)) setPhoto(a); });
  };
  const [porRecortar, setPorRecortar] = useState([]);
  const [recortar, setRecortar] = useState(false);
  const onFiles = (files) => { if (files.length) setPorRecortar(files); };
  const subirRecortadas = (files) => {
    setPorRecortar([]);
    if (files.length) run(async () => { await actions.addPhotos(p.id, files); setPhoto(p.photos.length); });
  };
  return (
    <div className="fixed inset-0 z-40 bg-slate-900 bg-opacity-40 flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-white overflow-y-auto vx-safe-b" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 h-14 border-b border-slate-100">
          <div className="flex items-center gap-2"><span className="vx-d font-bold text-lg">{p.codigo}</span><Pill>{p.estado}</Pill></div>
          <div className="flex items-center gap-1">
            {can.inv && p.estado !== "Vendido" && p.estado !== "Eliminado" && <Btn size="sm" variant="outline" onClick={() => { onClose(); setModal({ type: "product", edit: p }); }}><Pencil size={13} /> Editar</Btn>}
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <div className="relative aspect-square rounded-xl vx-photo overflow-hidden">
              <ProductPhoto p={p} idx={cur} fit="contain" />
              {p.photos[cur] && <button className="absolute inset-0 cursor-zoom-in" onClick={() => setVisor(true)} aria-label="Ver la foto completa en pantalla grande" />}
              {p.photos[cur] && <span className={`absolute top-2 ${can.inv ? "right-12" : "right-2"} pointer-events-none flex items-center gap-1 text-xs font-semibold bg-white text-slate-800 rounded-md px-2 py-1 shadow`}><ZoomIn size={13} /> Ampliar</span>}
              {cur === 0 && p.photos.length > 0 && <span className="absolute top-2 left-2 text-xs font-semibold bg-white text-slate-900 rounded-md px-2 py-0.5 flex items-center gap-1"><Star size={12} className="text-amber-500" /> Portada</span>}
              {can.inv && p.photos[cur] && (
                <button className="absolute top-2 right-2 p-1.5 rounded-lg bg-white text-rose-600 shadow" aria-label="Eliminar esta foto" disabled={busy}
                  onClick={() => { if (confirm("¿Eliminar esta foto?")) run(async () => { await actions.deletePhoto(p.photos[cur], p.codigo); setPhoto(0); }); }}><Trash2 size={15} /></button>
              )}
              {can.inv && p.photos[cur] && (
                <button className="absolute top-12 right-2 p-1.5 rounded-lg bg-white text-slate-700 shadow" aria-label="Recortar esta foto" title="Recortar" disabled={busy} onClick={() => setRecortar(true)}><Crop size={15} /></button>
              )}
              {can.inv && p.photos.length > 1 && (
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between gap-2">
                  <button disabled={busy || cur === 0} onClick={() => mover(cur, cur - 1)} className="p-2 rounded-lg bg-white shadow text-slate-700 disabled:opacity-30" aria-label="Mover foto a la izquierda"><ArrowLeft size={15} /></button>
                  {cur !== 0 && <button disabled={busy} onClick={() => mover(cur, 0)} className="px-3 py-1.5 rounded-lg bg-white shadow text-xs font-semibold text-slate-900 flex items-center gap-1"><Star size={13} className="text-amber-500" /> Usar como portada</button>}
                  <button disabled={busy || cur === p.photos.length - 1} onClick={() => mover(cur, cur + 1)} className="p-2 rounded-lg bg-white shadow text-slate-700 disabled:opacity-30" aria-label="Mover foto a la derecha"><ArrowRight size={15} /></button>
                </div>
              )}
              {busy && <div className="absolute inset-0 bg-white bg-opacity-70 grid place-items-center text-sm text-slate-600"><span className="flex items-center gap-2"><Spinner /> Subiendo…</span></div>}
            </div>
            <div className="flex gap-2 mt-2 overflow-x-auto vx-noscroll">
              {p.photos.map((f, i) => (
                <button key={f.id} onClick={() => setPhoto(i)} className={`relative w-16 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${cur === i ? "border-cyan-500" : "border-transparent"}`} aria-label={i === 0 ? "Foto de portada" : `Foto ${i + 1}`}>
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute top-0.5 left-0.5 bg-white rounded p-0.5"><Star size={10} className="text-amber-500" /></span>}
                </button>
              ))}
              {can.inv && <PhotoPicker compact disabled={busy} onFiles={onFiles} />}
            </div>
            {visor && <PhotoViewer urls={p.photos.map((f) => f.url)} start={cur} title={`${p.codigo} · ${p.marca} ${p.modelo}`} onClose={() => setVisor(false)} />}
            {porRecortar.length > 0 && <RecortarVarias files={porRecortar} onTerminar={subirRecortadas} onCancelar={() => setPorRecortar([])} />}
            {recortar && p.photos[cur] && <CropModal url={p.photos[cur].url} titulo="Recortar foto" onClose={() => setRecortar(false)} onDone={(f) => { setRecortar(false); const ph = p.photos[cur]; run(() => actions.replacePhoto(p.id, ph, f, p.codigo)); }} />}
          </div>
          {(p.videos.length > 0 || can.inv) && p.estado !== "Eliminado" && <VideosDelPar p={p} actions={actions} can={can} />}
          {p.estado !== "Eliminado" && (
            <Btn variant="lila" className="w-full" onClick={() => { onClose(); setModal({ type: "social", productId: p.id }); }}><Share2 size={15} /> Imagen para redes (precio, talla y cm)</Btn>
          )}
          {p.estado !== "Eliminado" && p.estado !== "Vendido" && <QrDelPar p={p} db={db} can={can} setModal={setModal} onClose={onClose} />}
          <div>
            <h2 className="vx-d text-xl font-bold">{p.marca} {p.modelo}</h2>
            {p.descripcion && <p className="text-sm text-slate-500">{p.descripcion}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[["Talla", p.talla], ["Largo", fcm(p.cm) || "—"], ["Color", p.color], ["Origen", p.origen], ["Categoría", p.categoria], ["Estado físico", p.estadoFisico], ["Lote", `${lot.id} · ${lot.nombre}`], ["Ingreso", fdate(p.fechaIngreso)], ["Registró", userName(p.socio)]].map(([k, v]) => (
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
          {sale && <div className={`rounded-xl p-3 text-sm ${sale.regalo ? "bg-amber-50" : "bg-slate-100"}`}><div className="font-medium flex items-center gap-1.5">{sale.regalo ? <><Gift size={14} className="text-amber-600" /> Regalado en {sale.id}</> : <>Vendido en {sale.id}</>}</div><div className="text-xs text-slate-600 mt-0.5">{client(sale.clienteId)?.nombre} · {fdate(sale.fecha)} · {userName(sale.socio)} · {sale.canal}</div></div>}
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
            <Btn variant="danger" className="w-full" onClick={() => { onClose(); setModal({ type: "deleteProducts", ids: [p.id] }); }}><Trash2 size={15} /> Eliminar este par</Btn>
          )}
          {p.estado === "Eliminado" && (
            <div className="rounded-xl bg-rose-50 p-3 text-sm space-y-2">
              <div><div className="font-medium text-rose-800">Eliminado del inventario</div><div className="text-xs text-rose-700 mt-0.5">{p.bajaMotivo || "Sin motivo"}{p.bajaEn ? ` · ${fdate(String(p.bajaEn).slice(0, 10))}` : ""} · {userName(p.bajaPor)}</div></div>
              {can.admin && <Btn size="sm" variant="outline" onClick={() => { if (confirm(`¿Devolver ${p.codigo} a Disponibles?`)) actions.restoreProduct(p).then((ok) => ok && onClose()); }}><RefreshCw size={13} /> Restaurar a disponibles</Btn>}
            </div>
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
    ? { lote: edit.lote, marca: edit.marca, modelo: edit.modelo, origen: edit.origen, categoria: edit.categoria, talla: edit.talla, color: edit.color, estadoFisico: edit.estadoFisico, precio: edit.precio, descripcion: edit.descripcion, obs: edit.obs, cm: edit.cm ?? "" }
    : { lote: ultimoLote?.id || "", marca: "", modelo: "", origen: "Americano", categoria: "Hombre", talla: 41, cm: "", color: "Blanco", estadoFisico: "Excelente", precio: "", descripcion: "", obs: "" });
  const [files, setFiles] = useState([]);
  const [vids, setVids] = useState([]);
  const [estadoVideo, setEstadoVideo] = useState("");
  const [busy, run] = useBusy();
  const [visorNuevo, setVisorNuevo] = useState(null);
  const [porRecortar, setPorRecortar] = useState([]);
  const [recortarUno, setRecortarUno] = useState(null);
  const lot = db.lots.find((l) => l.id === p.lote);
  const cost = edit ? pCost(edit) : lot ? lotTotal(lot) / lot.pares : 0;
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const colores = [...new Set([...COLORS.map((c) => c[0]), ...db.products.map((x) => x.color)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const cmTxt = String(p.cm ?? "").trim().replace(",", ".");
  const cmOk = cmTxt === "" || (Number(cmTxt) > 0 && Number(cmTxt) < 100);
  const portada = (i) => { const nf = [...files]; const [x] = nf.splice(i, 1); nf.unshift(x); setFiles(nf); };
  const ok = p.lote && p.marca.trim() && String(p.talla).trim() && Number(p.precio) >= 0 && String(p.precio) !== "" && String(p.color || "").trim() && cmOk;
  if (!db.lots.length) {
    return (
      <Modal title="Nuevo par" onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}>
        <p className="text-sm text-slate-600">Primero registra un lote en Compras y lotes: el costo de cada par sale de su lote.</p>
      </Modal>
    );
  }
  return (
    <Modal wide title={edit ? `Editar ${edit.codigo}` : "Nuevo par"} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy || !ok} onClick={() => run(async () => { if (await actions.saveProduct(p, files, edit?.id || null, vids, setEstadoVideo)) onClose(); })}>{busy ? <Spinner /> : null} {busy && estadoVideo ? estadoVideo : edit ? "Guardar cambios" : "Agregar al inventario"}</Btn></>}>
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          {previews.length ? (
            <button type="button" onClick={() => setVisorNuevo(0)} className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100" aria-label="Ver la portada en pantalla grande">
              <img src={previews[0]} alt="Portada" className="w-full h-full object-contain" />
              <span className="absolute top-2 right-2 flex items-center gap-1 text-xs font-semibold bg-white text-slate-800 rounded-md px-2 py-1 shadow"><ZoomIn size={13} /> Ampliar</span>
            </button>
          ) : (
            <div className="w-full aspect-square rounded-xl border-2 border-dashed border-slate-300 grid place-items-center text-center text-xs text-slate-500 p-3">
              <div><Camera size={24} className="mx-auto mb-1 text-slate-400" />{edit ? "Agrega más fotos" : "Saca una foto o elige de la galería"}</div>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <PhotoPicker disabled={files.length >= 8} max={8 - files.length} onFiles={(nf) => setPorRecortar(nf.slice(0, 8 - files.length))} />
          </div>
          {visorNuevo !== null && <PhotoViewer urls={previews} start={visorNuevo} title="Fotos del par nuevo" onClose={() => setVisorNuevo(null)} />}
          {porRecortar.length > 0 && <RecortarVarias files={porRecortar} onTerminar={(fs) => { setPorRecortar([]); setFiles((a) => [...a, ...fs].slice(0, 8)); }} onCancelar={() => setPorRecortar([])} />}
          {recortarUno !== null && files[recortarUno] && <CropModal file={files[recortarUno]} titulo="Recortar foto" onClose={() => setRecortarUno(null)} onDone={(f) => { setFiles(files.map((x, j) => (j === recortarUno ? f : x))); setRecortarUno(null); }} />}
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {previews.map((u, i) => (
                <div key={u} className={`relative w-14 h-14 rounded-md overflow-hidden border-2 ${i === 0 ? "border-amber-400" : "border-transparent"}`}>
                  <button type="button" className="w-full h-full" onClick={() => setVisorNuevo(i)} aria-label={`Ver foto ${i + 1}`}><img src={u} alt="" className="w-full h-full object-cover" /></button>
                  <button type="button" className="absolute top-0 right-0 bg-white rounded-bl p-0.5 text-rose-600" aria-label="Quitar foto" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button>
                  <button type="button" className="absolute top-0 left-0 bg-white rounded-br p-0.5 text-slate-700" aria-label="Recortar foto" title="Recortar" onClick={() => setRecortarUno(i)}><Crop size={12} /></button>
                  {i === 0
                    ? <span className="absolute bottom-0 inset-x-0 bg-amber-400 text-slate-900 text-xs font-semibold text-center leading-4">Portada</span>
                    : <button type="button" className="absolute bottom-0 left-0 bg-white rounded-tr p-0.5" aria-label="Usar como portada" title="Usar como portada" onClick={() => portada(i)}><Star size={12} className="text-amber-500" /></button>}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">Hasta 8 fotos. La del borde amarillo es la portada; toca la estrella de otra para cambiarla.</p>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 mb-1.5">Videos (opcional)</div>
            <div className="flex gap-2"><VideoPicker disabled={busy || vids.length >= 3} onFiles={(nv) => setVids([...vids, ...nv].slice(0, 3))} /></div>
            {vids.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{vids.map((f, i) => <VideoNuevo key={i + f.name} file={f} onQuitar={() => setVids(vids.filter((_, j) => j !== i))} />)}</div>}
            <p className="text-xs text-slate-400 mt-1">Hasta 3 por vez. Si un video pesa mucho, la app lo hace más liviano antes de subirlo.</p>
          </div>
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
          <Field label="Largo (cm)" hint={cmOk ? "Medida de la plantilla. Opcional." : "Escribe un número, por ejemplo 27 o 26,5."}><Input type="text" inputMode="decimal" placeholder="Ej.: 27" value={p.cm} onChange={(e) => setP({ ...p, cm: e.target.value })} /></Field>
          <Field label="Color" hint="Elige de la lista o escribe otro.">
            <input className={inputCls} list="vx-colores" value={p.color} placeholder="Ej.: Blanco con rojo" onChange={(e) => setP({ ...p, color: e.target.value })} />
            <datalist id="vx-colores">{colores.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
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

/** Imagen para publicar en redes: la portada con precio, talla y cm escritos encima */
export function SocialImageModal({ db, productId, onClose, toast }) {
  const p = db.products.find((x) => x.id === productId);
  const canvasRef = useRef(null);
  const fotoRef = useRef({ url: "", img: null });
  const [fotoIdx, setFotoIdx] = useState(0);
  const [formato, setFormato] = useState("cuadrado");
  const [precio, setPrecio] = useState(p ? bs0(p.precio) : "");
  const [extra, setExtra] = useState("");
  const [mostrar, setMostrar] = useState({ precio: true, talla: true, cm: true, titulo: true, codigo: true });
  const [encuadre, setEncuadre] = useState(ENCUADRE_INICIAL);
  const arrastre = useRef(null);
  const [estado, setEstado] = useState("cargando");
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const fijar = (e) => setEncuadre({ x: limitar(e.x, -0.9, 0.9), y: limitar(e.y, -0.9, 0.9), zoom: limitar(e.zoom, 0.5, 3) });
  const empezar = (ev) => {
    if (estado !== "listo") return;
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    const r = ev.currentTarget.getBoundingClientRect();
    arrastre.current = { px: ev.clientX, py: ev.clientY, x: encuadre.x, y: encuadre.y, w: r.width, h: r.height };
  };
  const mover = (ev) => {
    const a = arrastre.current;
    if (!a) return;
    fijar({ ...encuadre, x: a.x + (ev.clientX - a.px) / a.w, y: a.y + (ev.clientY - a.py) / a.h });
  };
  const soltar = () => { arrastre.current = null; };
  const rueda = (ev) => { if (estado === "listo") fijar({ ...encuadre, zoom: encuadre.zoom * (ev.deltaY < 0 ? 1.06 : 0.94) }); };
  const paso = (dx, dy) => fijar({ ...encuadre, x: encuadre.x + dx, y: encuadre.y + dy });
  const [busy, run] = useBusy();
  const foto = p?.photos?.[fotoIdx];
  const titulo = p ? `${p.marca} ${p.modelo}`.trim() : "";
  const texto = p ? [`${p.codigo} · ${titulo}`, `Talla ${p.talla}${p.cm ? ` · ${fcm(p.cm)}` : ""}`, `${p.estadoFisico} · ${p.color}`, precio, extra.trim()].filter(Boolean).join("\n") : "";

  useEffect(() => {
    if (!p || !foto) return;
    let vivo = true;
    (async () => {
      try {
        if (fotoRef.current.url !== foto.url) {
          setEstado("cargando");
          fotoRef.current = { url: foto.url, img: await cargarFoto(foto.url) };
        }
        if (!vivo || !canvasRef.current) return;
        await dibujarImagen(canvasRef.current, fotoRef.current.img, {
          formato: formato as any, precio, talla: String(p.talla), cm: p.cm ? String(p.cm) : "", titulo, codigo: p.codigo, extra, mostrar, encuadre,
        });
        if (vivo) setEstado("listo");
      } catch (e) {
        if (vivo) setEstado((e && e.message) || "No se pudo preparar la imagen.");
      }
    })();
    return () => { vivo = false; };
  }, [foto?.url, formato, precio, extra, mostrar.precio, mostrar.talla, mostrar.cm, mostrar.titulo, mostrar.codigo, encuadre.x, encuadre.y, encuadre.zoom]);

  if (!p) return null;
  const nombre = `${p.codigo}-vortex-${formato}.jpg`;
  const nav: any = typeof navigator !== "undefined" ? navigator : {};
  const puedeCompartir = !!nav.share && !!nav.canShare;
  const descargar = () => run(async () => { descargarBlob(await lienzoABlob(canvasRef.current), nombre); toast("Imagen descargada."); });
  const compartir = () => run(async () => {
    const file = new File([await lienzoABlob(canvasRef.current)], nombre, { type: "image/jpeg" });
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try { await nav.share({ files: [file], title: `${p.codigo} · VORTEX SNEAKERS`, text: texto }); } catch {}
    } else {
      descargarBlob(file, nombre);
      toast("Este navegador no permite compartir directo; la imagen se descargó.");
    }
  });
  const copiar = async () => { try { await navigator.clipboard.writeText(texto); toast("Texto copiado."); } catch { toast("No se pudo copiar el texto.", "err"); } };
  const Toggle = ({ k, label, disabled = false }) => (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "text-slate-300" : "text-slate-700"}`}>
      <input type="checkbox" className="w-4 h-4 accent-purple-700" disabled={disabled} checked={!disabled && mostrar[k]} onChange={() => setMostrar({ ...mostrar, [k]: !mostrar[k] })} />{label}
    </label>
  );

  return (
    <Modal wide title={`Imagen para redes · ${p.codigo}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      {foto && puedeCompartir && <Btn variant="outline" disabled={busy || estado !== "listo"} onClick={compartir}><Share2 size={15} /> Compartir</Btn>}
      {foto && <Btn disabled={busy || estado !== "listo"} onClick={descargar}>{busy ? <Spinner /> : <Download size={15} />} Descargar imagen</Btn>}
    </>}>
      {!foto ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-10 px-4 text-center text-sm text-slate-500">
          Este par todavía no tiene fotos. Agrega una desde su ficha y vuelve aquí.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="relative rounded-xl overflow-hidden bg-slate-900 mx-auto" style={{ aspectRatio: `${FORMATOS[formato].w} / ${FORMATOS[formato].h}`, maxHeight: "60vh" }}>
              <canvas ref={canvasRef} className={`w-full h-full object-contain ${estado === "listo" ? "cursor-grab active:cursor-grabbing" : ""}`} style={{ touchAction: "none" }}
                aria-label="Vista previa: arrastra la foto para acomodarla"
                onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onWheel={rueda} />
              {estado !== "listo" && (
                <div className="absolute inset-0 grid place-items-center bg-slate-900 text-sm text-white p-4 text-center">
                  {estado === "cargando" ? <span className="flex items-center gap-2"><Spinner /> Preparando la imagen…</span> : estado}
                </div>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-700">Acomodar la foto</span>
                <button className="text-xs font-semibold text-purple-700 disabled:opacity-40" disabled={encuadre.x === 0 && encuadre.y === 0 && encuadre.zoom === 1} onClick={() => setEncuadre(ENCUADRE_INICIAL)}>Restablecer</button>
              </div>
              <p className="text-xs text-slate-500">Arrastra la foto con el dedo o el mouse. Usa el control para acercar o alejar.</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-10">Alejar</span>
                <input type="range" min="0.5" max="3" step="0.01" value={encuadre.zoom} onChange={(e) => fijar({ ...encuadre, zoom: Number(e.target.value) })} className="flex-1 accent-purple-700" aria-label="Tamaño de la foto" />
                <span className="text-xs text-slate-500 w-10 text-right">Acercar</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[["Subir", 0, -0.04], ["Bajar", 0, 0.04], ["Izquierda", -0.04, 0], ["Derecha", 0.04, 0]].map(([l, dx, dy]) => (
                  <button key={l as string} className="text-xs py-1.5 rounded-md border border-slate-200 hover:bg-slate-50" onClick={() => paso(dx, dy)}>{l}</button>
                ))}
              </div>
            </div>
            {p.photos.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto vx-noscroll">
                {p.photos.map((f, i) => (
                  <button key={f.id} onClick={() => { setFotoIdx(i); setEncuadre(ENCUADRE_INICIAL); }} className={`relative w-14 h-11 shrink-0 rounded-md overflow-hidden border-2 ${fotoIdx === i ? "border-purple-700" : "border-transparent"}`} aria-label={i === 0 ? "Usar la portada" : `Usar la foto ${i + 1}`}>
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute top-0.5 left-0.5 bg-white rounded p-0.5"><Star size={9} className="text-amber-500" /></span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Formato</div>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-lg p-1" role="radiogroup" aria-label="Formato">
                {Object.entries(FORMATOS).map(([k, f]) => (
                  <button key={k} role="radio" aria-checked={formato === k} onClick={() => setFormato(k)} className={`text-xs py-1.5 rounded-md ${formato === k ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500"}`}>{f.label}</button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">{FORMATOS[formato].hint}</p>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1.5">Datos sobre la foto</div>
              <div className="grid grid-cols-2 gap-2">
                <Toggle k="precio" label="Precio" />
                <Toggle k="talla" label={`Talla ${p.talla}`} />
                <Toggle k="cm" label={p.cm ? fcm(p.cm) : "cm (sin medida)"} disabled={!p.cm} />
                <Toggle k="titulo" label="Marca y modelo" />
                <Toggle k="codigo" label={`Código ${p.codigo}`} />
              </div>
              {!p.cm && <p className="text-xs text-slate-500 mt-1">Para mostrar los centímetros, edita el par y llena “Largo (cm)”.</p>}
            </div>
            <Field label="Precio en la imagen" hint="Puedes cambiarlo solo para esta publicación, por ejemplo una oferta."><Input value={precio} onChange={(e) => setPrecio(e.target.value)} /></Field>
            <Field label="Texto adicional (opcional)"><Input value={extra} placeholder="Ej.: Envíos a todo Bolivia" maxLength={60} onChange={(e) => setExtra(e.target.value)} /></Field>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-slate-600">Texto para la publicación</span><button className="text-xs font-semibold text-purple-700" onClick={copiar}>Copiar texto</button></div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{texto}</pre>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Bloque de la ficha: el QR de pago que usa este par */
function QrDelPar({ p, db, can, setModal, onClose }) {
  const qr = p.qrId ? db.qrs.find((q) => q.id === p.qrId) : null;
  if (!qr && !can.inv) return null;
  if (!qr) return (
    <button onClick={() => { onClose(); setModal({ type: "qrAssign", ids: [p.id] }); }} className="w-full flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-left hover:border-purple-500">
      <QrCode size={22} className="text-slate-400" /><span className="flex-1"><span className="block text-sm font-semibold">Sin QR de pago</span><span className="block text-xs text-slate-500">Asígnale un QR para que el cliente pueda pagar.</span></span><Plus size={16} className="text-purple-700" />
    </button>
  );
  const distinto = qr.monto && Number(qr.monto) !== Number(p.precio);
  return (
    <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
      <button onClick={() => { onClose(); setModal({ type: "qrView", qrId: qr.id }); }} className="w-16 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0" aria-label="Ver QR en grande"><img src={qr.url} alt="" className="w-full h-full object-contain" /></button>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500">QR de pago</div>
        <div className="text-sm font-semibold truncate">{qr.nombre}</div>
        {distinto && <div className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> El QR es de {bs0(qr.monto)} y el par cuesta {bs0(p.precio)}</div>}
      </div>
      <div className="flex flex-col gap-1">
        <Btn size="sm" variant="outline" onClick={() => { onClose(); setModal({ type: "qrView", qrId: qr.id }); }}><Share2 size={13} /> Compartir</Btn>
        {can.inv && <Btn size="sm" variant="ghost" onClick={() => { onClose(); setModal({ type: "qrAssign", ids: [p.id] }); }}>Cambiar</Btn>}
      </div>
    </div>
  );
}

// Vista previa de un video elegido (todavía no subido)
function VideoNuevo({ file, onQuitar }) {
  const [url, setUrl] = useState("");
  const [ver, setVer] = useState(false);
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <>
      <VideoThumb v={{ localUrl: url }} onClick={() => setVer(true)} className="w-20 h-14 rounded-md">
        <button type="button" className="absolute top-0 right-0 bg-white rounded-bl p-0.5 text-rose-600" aria-label="Quitar video" onClick={onQuitar}><X size={12} /></button>
        <span className="absolute bottom-0 left-0 pointer-events-none text-[10px] text-white bg-black/60 rounded-tr px-1">{(file.size / 1048576).toFixed(0)} MB</span>
      </VideoThumb>
      {ver && url && <VideoPlayer url={url} title="Video nuevo" onClose={() => setVer(false)} />}
    </>
  );
}

// Ficha del par: sus videos (ver, agregar, eliminar)
function VideosDelPar({ p, actions, can }) {
  const [ver, setVer] = useState(null);
  const [estado, setEstado] = useState("");
  const [busy, run] = useBusy();
  const agregar = (fs) => run(async () => { await actions.addVideos(p.id, fs, setEstado); setEstado(""); });
  return (
    <div>
      <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Video size={13} /> Videos{p.videos.length ? ` (${p.videos.length})` : ""}</div>
      <div className="flex gap-2 overflow-x-auto vx-noscroll">
        {p.videos.map((v) => (
          <VideoThumb key={v.id} v={v} onClick={() => setVer(v)} className="w-24 h-16 shrink-0 rounded-lg">
            {can.inv && <button type="button" disabled={busy} className="absolute top-0.5 right-0.5 p-1 rounded bg-white text-rose-600" aria-label="Eliminar video" onClick={() => { if (confirm("¿Eliminar este video?")) run(() => actions.deleteVideo(v, p.codigo)); }}><Trash2 size={12} /></button>}
          </VideoThumb>
        ))}
        {can.inv && !busy && <VideoPicker compact onFiles={agregar} />}
      </div>
      {busy && <div className="mt-2 text-xs text-slate-600 flex items-center gap-2"><Spinner /> {estado || "Trabajando…"}</div>}
      {ver && <VideoPlayer url={ver.url} title={`${p.codigo} · ${p.marca} ${p.modelo}`} onClose={() => setVer(null)} />}
    </div>
  );
}
