import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Package, Truck, Users, ShoppingBag, Wallet, BarChart3, Shield, Settings, Search, Plus, Menu, Bell,
  LogOut, Clock, CheckCircle2, AlertTriangle, History, Layers, CalendarDays, MoreHorizontal, KeyRound, WifiOff,
} from "lucide-react";
import { supabase, configurado, mensajeError } from "./lib/supabase";
import { cargarTodo, crearAcciones, DB_VACIA } from "./lib/data";
import { computeMetrics, agendaEvents, reminderState, TIPOS_EVENTO, TODAY, fechaLarga, tick, ACCESO, permisos, ROLES } from "./lib/utils";
import { Logo, Btn } from "./components/ui";
import { Login, Cargando, SinConfigurar, SinAcceso } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Inventory, ProductDrawer, ProductModal, DeleteProductsModal, SocialImageModal } from "./pages/Inventory";
import { ReserveModal, SellModal, PayModal, VoidModal, Reservations, Sales, Orders, OrderDetail } from "./pages/Sales";
import { Lots, LotModal, ProviderModal } from "./pages/Lots";
import { Clients, ClientModal, ClientDetail } from "./pages/Clients";
import { Finance, ExpenseModal, IncomeModal } from "./pages/Finance";
import { Reports } from "./pages/Reports";
import { Agenda, EventModal } from "./pages/Agenda";
import { Activity, ConfigPage, SearchModal, UsersPage, UserModal, MyPasswordModal } from "./pages/Admin";

const NAV = [
  { group: "General", items: [["dashboard", "Dashboard", LayoutDashboard], ["agenda", "Agenda", CalendarDays]] },
  { group: "Operación", items: [["inventario", "Inventario", Package], ["lotes", "Compras y lotes", Layers], ["reservas", "Reservas", Clock], ["ventas", "Ventas", ShoppingBag], ["pedidos", "Pedidos y entregas", Truck], ["clientes", "Clientes", Users]] },
  { group: "Finanzas", items: [["finanzas", "Finanzas", Wallet], ["reportes", "Reportes", BarChart3]] },
  { group: "Administración", items: [["usuarios", "Usuarios y permisos", Shield], ["actividad", "Actividad", History], ["config", "Configuración", Settings]] },
];
const RUTAS = { dashboard: "/", agenda: "/agenda", inventario: "/inventario", lotes: "/compras", reservas: "/reservas", ventas: "/ventas", pedidos: "/pedidos", clientes: "/clientes", finanzas: "/finanzas", reportes: "/reportes", usuarios: "/usuarios", actividad: "/actividad", config: "/configuracion" };
const PAGINA_DE_RUTA = Object.fromEntries(Object.entries(RUTAS).map(([k, v]) => [v, k]));
const PAGINAS = { agenda: Agenda, dashboard: Dashboard, inventario: Inventory, lotes: Lots, reservas: Reservations, ventas: Sales, pedidos: Orders, clientes: Clients, finanzas: Finance, reportes: Reports, usuarios: UsersPage, actividad: Activity, config: ConfigPage };

export default function App() {
  if (!configurado) return <SinConfigurar />;
  return <Sesion />;
}

/** Maneja el inicio de sesión y el perfil del usuario */
function Sesion() {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s || null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPerfil(session === null ? null : undefined); return; }
    setPerfil(undefined);
    supabase.from("perfiles").select("*").eq("id", session.user.id).maybeSingle().then(({ data, error }) => {
      setPerfil(error ? { error: mensajeError(error) } : data || { activo: false });
    });
  }, [session?.user?.id]);

  if (session === undefined) return <Cargando />;
  if (!session) return <Login />;
  if (perfil === undefined) return <Cargando texto="Verificando tu acceso…" />;
  if (perfil?.error) return <SinAcceso email={session.user.email} motivo={perfil.error} />;
  if (!perfil?.activo) return <SinAcceso email={session.user.email} />;
  return <Sistema perfil={perfil} />;
}

/** El sistema una vez dentro */
function Sistema({ perfil }) {
  const me = perfil.id;
  const rol = perfil.rol;
  const can = permisos(rol);
  const acceso = ACCESO[rol] || [];
  const inicio = acceso[0] === "dashboard" ? "dashboard" : "inventario";

  const [db, setDb] = useState(DB_VACIA);
  const [cargado, setCargado] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [offline, setOffline] = useState(false);
  const [, setReloj] = useState(0);
  const [path, setPath] = useState(window.location.pathname);
  const [navOpen, setNavOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const recargando = useRef(false);
  const yaCargo = useRef(false);
  const pendiente = useRef(false);
  const ultimaLiberacion = useRef(0);

  const toast = useCallback((msg, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "err" ? 6500 : 3800);
  }, []);

  const recargar = useCallback(async () => {
    if (recargando.current) { pendiente.current = true; return; }
    recargando.current = true;
    try {
      // Cada 2 minutos como máximo: devuelve a disponibles las reservas vencidas sin adelanto
      if (Date.now() - ultimaLiberacion.current > 120000) {
        ultimaLiberacion.current = Date.now();
        try { await supabase.rpc("liberar_reservas_vencidas"); } catch {}
      }
      const nuevo = await cargarTodo(rol === "admin");
      tick();
      setDb(nuevo);
      setCargado(true);
      yaCargo.current = true;
      setErrorCarga("");
      setOffline(false);
    } catch (e) {
      if (!yaCargo.current) setErrorCarga(mensajeError(e));
      else setOffline(true);
    } finally {
      recargando.current = false;
      if (pendiente.current) { pendiente.current = false; recargar(); }
    }
  }, [rol]);

  // Carga inicial + cambios en tiempo real del otro socio + reloj
  useEffect(() => {
    recargar();
    let timer = null;
    const programar = () => { clearTimeout(timer); timer = setTimeout(recargar, 700); };
    const canal = supabase.channel("vortex-cambios")
      .on("postgres_changes", { event: "*", schema: "public" }, programar)
      .subscribe();
    const reloj = setInterval(() => { tick(); setReloj((n) => n + 1); }, 60000);
    const revisarReservas = setInterval(recargar, 5 * 60000);
    const alVolver = () => { if (document.visibilityState === "visible") recargar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", recargar);
    return () => {
      clearTimeout(timer); clearInterval(reloj); clearInterval(revisarReservas);
      supabase.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", recargar);
    };
  }, []);

  // Navegación con el botón "atrás" del navegador o del celular
  useEffect(() => {
    const onPop = () => { setPath(window.location.pathname); setModal(null); setDrawer(null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (key) => {
    const ruta = RUTAS[key] || "/";
    if (ruta !== window.location.pathname) window.history.pushState({}, "", ruta);
    setPath(ruta);
    setNavOpen(false);
    window.scrollTo(0, 0);
  };

  let page = PAGINA_DE_RUTA[path] || inicio;
  if (!acceso.includes(page)) page = inicio;

  const actions = useMemo(() => crearAcciones({ db, me, recargar, toast }), [db, me, recargar, toast]);
  const m = useMemo(() => computeMetrics(db), [db]);
  const userName = (id) => db.users.find((u) => u.id === id)?.nombre || (id ? "Usuario" : "Sistema");
  const client = (id) => db.clients.find((c) => c.id === id);
  const prod = (id) => db.products.find((p) => p.id === id);

  // Avisos del navegador cuando llega un recordatorio (si el usuario lo permite)
  const events = agendaEvents(db);
  const alerts = events.filter((e) => reminderState(e));
  const avisados = useRef(new Set());
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    alerts.forEach((e) => {
      if (avisados.current.has(e.id)) return;
      avisados.current.add(e.id);
      try { new Notification("VORTEX · " + e.titulo, { body: `${e.fecha === TODAY ? "Hoy" : fechaLarga(e.fecha)} a las ${e.hora}`, icon: "/icon-192.png" }); } catch {}
    });
  }, [alerts.map((e) => e.id).join(",")]);

  if (errorCarga) return <SinAcceso email={perfil.email} motivo={errorCarga} />;
  if (!cargado) return <Cargando texto="Cargando el negocio…" />;

  const ctx = { db, m, me, actions, setModal, setDrawer, go, userName, client, prod, toast, can, rol };
  const badges = { agenda: alerts.length, reservas: db.reservations.filter((r) => r.estado === "Activa").length, pedidos: db.sales.filter((s) => s.estado === "Activa" && s.pedido !== "Entregado").length };
  const Page = PAGINAS[page];
  const iniciales = (perfil.nombre || perfil.email || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const pedirAvisos = () => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); };

  const Sidebar = (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100 shrink-0"><Logo /></div>
      <div className="flex-1 overflow-y-auto py-3">
        {NAV.map((g) => {
          const items = g.items.filter(([k]) => acceso.includes(k));
          if (!items.length) return null;
          return (
            <div key={g.group} className="mb-3">
              <div className="px-5 py-1 text-xs font-medium text-slate-400">{g.group}</div>
              {items.map(([key, label, Icon]) => (
                <button key={key} onClick={() => go(key)} aria-current={page === key ? "page" : undefined} className={`w-full flex items-center gap-3 px-5 py-2.5 lg:py-2 text-sm transition-colors ${page === key ? "text-cyan-800 bg-cyan-50 border-r-2 border-cyan-500 font-medium" : "text-slate-600 hover:bg-slate-50"}`}>
                  <Icon size={17} /> <span className="flex-1 text-left">{label}</span>
                  {badges[key] > 0 && <span className="text-xs rounded-full bg-purple-100 text-purple-700 px-1.5">{badges[key]}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-slate-100 space-y-1 vx-safe-b">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-full vx-grad text-white grid place-items-center text-xs font-bold shrink-0">{iniciales}</div>
          <div className="min-w-0"><div className="text-sm font-medium truncate">{perfil.nombre}</div><div className="text-xs text-slate-500 truncate">{ROLES[rol]}</div></div>
        </div>
        <button onClick={() => { setNavOpen(false); setModal({ type: "myPassword" }); }} className="w-full flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md px-2 py-1.5"><KeyRound size={15} /> Cambiar mi contraseña</button>
        <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md px-2 py-1.5"><LogOut size={15} /> Cerrar sesión</button>
      </div>
    </nav>
  );

  const bottom = [
    can.admin ? ["dashboard", "Inicio", LayoutDashboard] : ["inventario", "Inventario", Package],
    can.admin ? ["inventario", "Inventario", Package] : can.sell ? ["reservas", "Reservas", Clock] : ["lotes", "Lotes", Layers],
    can.sell ? ["__sell", "Vender", Plus] : ["pedidos", "Pedidos", Truck],
    ["agenda", "Agenda", CalendarDays],
    ["__menu", "Más", MoreHorizontal],
  ];

  return (
    <div className="vx min-h-screen bg-slate-50 text-slate-800">
      <aside className="print:hidden hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30">{Sidebar}</aside>
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900 bg-opacity-40" onClick={() => setNavOpen(false)}>
          <aside className="w-72 max-w-full h-full bg-white vx-safe-t" onClick={(e) => e.stopPropagation()}>{Sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64 print:pl-0">
        <header className="print:hidden sticky top-0 z-20 bg-white border-b border-slate-200 vx-safe-t">
          <div className="h-14 sm:h-16 flex items-center gap-2 sm:gap-3 px-3 sm:px-6">
            <button className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-100" onClick={() => setNavOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
            <button onClick={() => setModal({ type: "search" })} className="flex-1 max-w-md flex items-center gap-2 text-sm text-slate-400 bg-slate-100 rounded-lg px-3 py-2 hover:bg-slate-200">
              <Search size={16} className="shrink-0" /><span className="truncate"><span className="sm:hidden">Buscar</span><span className="hidden sm:inline">Buscar por código, marca o cliente</span></span>
            </button>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {offline && <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600" title="Sin conexión"><WifiOff size={15} /> Sin conexión</span>}
              {can.sell && <Btn size="sm" onClick={() => setModal({ type: "sell", productIds: [] })} className="hidden sm:inline-flex"><Plus size={15} /> Nueva venta</Btn>}
              <div className="relative">
                <button className="relative p-2 rounded-md hover:bg-slate-100" onClick={() => { setBellOpen(!bellOpen); pedirAvisos(); }} aria-label="Recordatorios" aria-expanded={bellOpen}>
                  <Bell size={18} />{alerts.length > 0 && <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-xs leading-4 text-center">{alerts.length}</span>}
                </button>
                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
                    <div className="absolute right-0 top-11 w-80 max-w-xs bg-white rounded-xl border border-slate-200 shadow-xl z-30 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"><span className="text-sm font-semibold">Recordatorios</span><button className="text-xs text-purple-700 font-medium" onClick={() => { setBellOpen(false); go("agenda"); }}>Abrir agenda</button></div>
                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                        {alerts.map((e) => (
                          <button key={e.id} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex gap-3" onClick={() => { setBellOpen(false); go("agenda"); }}>
                            <span className="w-1 rounded-full self-stretch" style={{ background: TIPOS_EVENTO[e.tipo] }} />
                            <span className="flex-1">
                              <span className="block text-sm font-medium">{e.titulo}</span>
                              <span className={`block text-xs ${reminderState(e) === "atrasado" ? "text-rose-600" : "text-slate-500"}`}>{reminderState(e) === "atrasado" ? "Atrasado · " : ""}{e.fecha === TODAY ? "Hoy" : fechaLarga(e.fecha)} a las {e.hora}</span>
                            </span>
                          </button>
                        ))}
                        {!alerts.length && <p className="px-4 py-6 text-sm text-slate-400 text-center">No hay recordatorios pendientes.</p>}
                      </div>
                      {"Notification" in window && Notification.permission === "default" && <button className="w-full px-4 py-2.5 text-xs text-left text-purple-700 border-t border-slate-100" onClick={pedirAvisos}>Activar avisos en este dispositivo</button>}
                    </div>
                  </>
                )}
              </div>
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full vx-grad text-white grid place-items-center text-xs font-bold">{iniciales}</div>
                <div className="leading-tight"><div className="text-sm font-medium">{perfil.nombre}</div><div className="text-xs text-slate-500">{ROLES[rol]}</div></div>
                <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
              </div>
            </div>
          </div>
          {offline && <div className="sm:hidden bg-amber-50 text-amber-700 text-xs px-3 py-1 flex items-center gap-1"><WifiOff size={13} /> Sin conexión: los datos pueden no estar al día.</div>}
        </header>
        <main className="vx-print-area p-3 sm:p-6 pb-28 lg:pb-6 max-w-screen-2xl"><Page {...ctx} /></main>
      </div>

      {/* Barra inferior: solo en celular y tablet */}
      <nav className="print:hidden lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 vx-safe-b" aria-label="Navegación principal">
        <div className="grid grid-cols-5 items-end h-16">
          {bottom.map(([k, l, I]) => k === "__sell" ? (
            <button key={k} onClick={() => setModal({ type: "sell", productIds: [] })} className="flex flex-col items-center gap-0.5 pb-1.5" aria-label="Nueva venta">
              <span className="w-12 h-12 -mt-5 rounded-full vx-grad text-white grid place-items-center shadow-lg ring-4 ring-white"><Plus size={22} /></span>
              <span className="text-xs font-semibold text-purple-700">{l}</span>
            </button>
          ) : (
            <button key={k} onClick={() => (k === "__menu" ? setNavOpen(true) : go(k))} className={`relative flex flex-col items-center justify-center gap-0.5 h-full text-xs ${page === k ? "text-purple-700 font-semibold" : "text-slate-500"}`} aria-current={page === k ? "page" : undefined}>
              <I size={21} />{l}
              {k === "agenda" && alerts.length > 0 && <span className="absolute top-2 right-1/4 w-2 h-2 rounded-full bg-rose-500" />}
            </button>
          ))}
        </div>
      </nav>

      {drawer && <ProductDrawer {...ctx} id={drawer} onClose={() => setDrawer(null)} />}
      {modal?.type === "reserve" && <ReserveModal {...ctx} productId={modal.productId} onClose={() => setModal(null)} />}
      {modal?.type === "sell" && <SellModal {...ctx} init={modal} onClose={() => setModal(null)} />}
      {modal?.type === "pay" && <PayModal {...ctx} ventaId={modal.ventaId} onClose={() => setModal(null)} />}
      {modal?.type === "void" && <VoidModal {...ctx} ventaId={modal.ventaId} onClose={() => setModal(null)} />}
      {modal?.type === "expense" && <ExpenseModal {...ctx} onClose={() => setModal(null)} />}
      {modal?.type === "income" && <IncomeModal {...ctx} onClose={() => setModal(null)} />}
      {modal?.type === "client" && <ClientModal {...ctx} edit={modal.edit || null} onClose={() => setModal(null)} />}
      {modal?.type === "lot" && <LotModal {...ctx} edit={modal.edit || null} onClose={() => setModal(null)} />}
      {modal?.type === "provider" && <ProviderModal {...ctx} edit={modal.edit} onClose={() => setModal(null)} />}
      {modal?.type === "social" && <SocialImageModal {...ctx} productId={modal.productId} onClose={() => setModal(null)} />}
      {modal?.type === "deleteProducts" && <DeleteProductsModal {...ctx} ids={modal.ids} onDone={modal.onDone} onClose={() => setModal(null)} />}
      {modal?.type === "product" && <ProductModal {...ctx} edit={modal.edit || null} onClose={() => setModal(null)} />}
      {modal?.type === "user" && <UserModal {...ctx} edit={modal.edit || null} onClose={() => setModal(null)} />}
      {modal?.type === "myPassword" && <MyPasswordModal {...ctx} onClose={() => setModal(null)} />}
      {modal?.type === "clientDetail" && <ClientDetail {...ctx} id={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === "search" && <SearchModal {...ctx} onClose={() => setModal(null)} />}
      {modal?.type === "event" && <EventModal {...ctx} init={modal} onClose={() => setModal(null)} />}
      {modal?.type === "order" && <OrderDetail {...ctx} ventaId={modal.ventaId} onClose={() => setModal(null)} />}

      <div className="print:hidden fixed bottom-24 lg:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-50 space-y-2 sm:max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex gap-2 items-start rounded-xl px-4 py-3 shadow-lg text-sm text-white ${t.tone === "err" ? "bg-rose-600" : "bg-slate-900"}`}>
            {t.tone === "err" ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-cyan-300" />}{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
