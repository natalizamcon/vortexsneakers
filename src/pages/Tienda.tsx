// Tienda en línea de VORTEX SNEAKERS: catálogo público, cuenta de cliente y pedidos.
// Aquí NUNCA se leen tablas internas: todo llega de funciones que solo devuelven datos de compra.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag, Search, X, ZoomIn, Check, Plus, Trash2, Store, Truck, Package, Clock, LogOut, User,
  CheckCircle2, AlertTriangle, ChevronRight, MapPin, RefreshCw, QrCode, Download, Eye, ArrowLeft, Upload, Camera, FileText, Play,
} from "lucide-react";
import { supabase, fotoUrl, mensajeError, comprimirImagen, BUCKET_COMPROBANTES } from "../lib/supabase";
import { bs0, fcm, colorHex, norm, ftime, fdate, DEPARTAMENTOS } from "../lib/utils";
import { Logo, Isotipo, Btn, Field, Input, Select, inputCls, Modal, PasswordInput, ProductPhoto, Spinner, Pill, useBusy } from "../components/ui";
import { PhotoViewer } from "../components/photos";
import { fijarAvisoSalir, usePaginaAtras } from "../lib/atras";
import { VideoThumb, VideoPlayer } from "../components/videos";

const BOLSA_KEY = "vx-bolsa";
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Solo dos formas de entrega, siempre por paquetería
const ENTREGAS = [
  { k: "cochabamba", titulo: "Paquetería en Cochabamba", desc: "Lo dejamos en una paquetería de Cochabamba y lo recoges ahí.", icon: Package },
  { k: "envio", titulo: "Envío a otro departamento", desc: "Lo enviamos por encomienda a tu departamento, ciudad o provincia de Bolivia.", icon: Truck },
];
const ZONAS = ["Cercado", "Sacaba", "Quillacollo", "Tiquipaya", "Colcapirhua", "Vinto", "Sipe Sipe", ...DEPARTAMENTOS];

/** Convierte un par del catálogo público al formato que usan las fotos de la app */
const aPar = (x) => ({
  ...x, precio: Number(x.precio) || 0, talla: Number(x.talla), cm: x.cm == null ? null : Number(x.cm),
  estadoFisico: x.estado_fisico, hex: colorHex(x.color),
  photos: (x.fotos || []).map((ruta) => ({ id: ruta, url: fotoUrl(ruta) })),
  videos: (x.videos || []).map((v) => ({ id: v.ruta, url: fotoUrl(v.ruta), portadaUrl: v.portada ? fotoUrl(v.portada) : "", duracion: v.duracion })),
});

export function Tienda({ cuenta, onCuentaCambio, vistaPrevia = false, onSalirVista = () => {} }) {
  // En la vista previa del equipo, la lista de pares se guarda aparte para no mezclarla
  const llaveBolsa = vistaPrevia ? BOLSA_KEY + "-vista" : BOLSA_KEY;
  const [cat, setCat] = useState(null);
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState({ destinos: DEPARTAMENTOS, vigencia_horas: 48, whatsapp: "62035357", paqueteria: "" });
  const [vista, setVista] = useState("catalogo");
  const [q, setQ] = useState("");
  const [talla, setTalla] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [orden, setOrden] = useState("recientes");
  const [bolsa, setBolsa] = useState(() => leer(llaveBolsa, []));
  const [detalle, setDetalle] = useState(null);
  const [visor, setVisor] = useState(null);
  const [bolsaAbierta, setBolsaAbierta] = useState(false);
  const [directo, setDirecto] = useState(null); // "Lo compro": comprar solo ese par
  const [auth, setAuth] = useState(null); // { modo, motivo }
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [destacar, setDestacar] = useState("");
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "err" ? 6500 : 3800);
  }, []);
  // Botón "atrás" del celular: vuelve al catálogo en vez de salir de la tienda
  useEffect(() => { fijarAvisoSalir((t) => toast(t)); }, [toast]);
  usePaginaAtras(() => {
    if (vista !== "catalogo") { setVista("catalogo"); window.scrollTo(0, 0); return true; }
    if (vistaPrevia) { onSalirVista(); return true; }
    return false;
  });

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("catalogo_publico");
    if (error) { setError(mensajeError(error)); return; }
    setError("");
    const pares = (data || []).map(aPar);
    setCat(pares);
    // Si algún par de la bolsa ya se vendió o lo apartó otra persona, se quita
    setBolsa((b) => {
      const quedan = b.filter((id) => pares.some((p) => p.id === id));
      if (quedan.length < b.length) toast(`${b.length - quedan.length === 1 ? "Un par de tu pedido ya no está" : `${b.length - quedan.length} pares de tu pedido ya no están`} disponible${b.length - quedan.length === 1 ? "" : "s"}. Lo quitamos de tu lista.`, "err");
      return quedan;
    });
  }, [toast]);

  useEffect(() => {
    cargar();
    supabase.rpc("tienda_config").then(({ data }) => { if (data) setCfg({ destinos: data.destinos?.length ? data.destinos : DEPARTAMENTOS, vigencia_horas: data.vigencia_horas || 48, whatsapp: data.whatsapp || "62035357", paqueteria: data.paqueteria || "" }); });
    const t = setInterval(cargar, 60000);
    const vis = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", vis);
    // Al volver de iniciar sesión para enviar el pedido, se abre la bolsa otra vez
    try {
      const v = !vistaPrevia && sessionStorage.getItem("vx-abrir-bolsa");
      if (v) { sessionStorage.removeItem("vx-abrir-bolsa"); if (v.startsWith("d:")) setDirecto(v.slice(2)); else setBolsaAbierta(true); }
    } catch {}
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [cargar]);
  useEffect(() => guardar(llaveBolsa, bolsa), [bolsa, llaveBolsa]);

  const tallas = useMemo(() => [...new Set((cat || []).map((p) => p.talla))].sort((a, b) => a - b), [cat]);
  const categorias = useMemo(() => ["Todas", ...new Set((cat || []).map((p) => p.categoria).filter(Boolean))], [cat]);
  const lista = useMemo(() => {
    const palabras = norm(q).split(/\s+/).filter(Boolean);
    let l = (cat || []).filter((p) => {
      const t = norm(`${p.codigo} ${p.marca} ${p.modelo} ${p.color} ${p.categoria} talla ${p.talla}`);
      return palabras.every((w) => t.includes(w)) && (!talla || String(p.talla) === talla) && (categoria === "Todas" || p.categoria === categoria);
    });
    if (orden === "menor") l = [...l].sort((a, b) => a.precio - b.precio);
    if (orden === "mayor") l = [...l].sort((a, b) => b.precio - a.precio);
    return l;
  }, [cat, q, talla, categoria, orden]);

  const enBolsa = (id) => bolsa.includes(id);
  const alternar = (p) => {
    if (enBolsa(p.id)) { setBolsa(bolsa.filter((x) => x !== p.id)); return; }
    if (bolsa.length >= 5) { toast("Puedes pedir hasta 5 pares a la vez.", "err"); return; }
    setBolsa([...bolsa, p.id]);
  };
  const comprarYa = (p) => { setDetalle(null); setDirecto(p.id); };
  const salir = async () => { setCuentaAbierta(false); await supabase.auth.signOut(); };
  const pDetalle = detalle && (cat || []).find((p) => p.id === detalle);

  return (
    <div className="vx min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 vx-safe-t">
        {vistaPrevia && (
          <div className="vx-grad text-white">
            <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-2 text-sm">
              <Eye size={16} className="shrink-0" />
              <span className="flex-1 leading-tight"><b>Vista de cliente.</b> <span className="hidden sm:inline">Así ven la tienda tus clientes. Puedes navegar y armar un pedido de prueba, pero no se envía.</span><span className="sm:hidden">Así la ven tus clientes.</span></span>
              <button onClick={onSalirVista} className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white text-purple-800 font-semibold px-3 py-1.5 text-xs sm:text-sm"><ArrowLeft size={14} /> Volver al sistema</button>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto h-16 px-3 sm:px-6 flex items-center gap-2">
          <button onClick={() => setVista("catalogo")} aria-label="Ir al catálogo"><Logo /></button>
          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            {cuenta && (
              <button onClick={() => setVista(vista === "pedidos" ? "catalogo" : "pedidos")} className={`hidden sm:inline-flex px-3 py-2 rounded-lg text-sm font-medium ${vista === "pedidos" ? "bg-purple-50 text-purple-700" : "text-slate-600 hover:bg-slate-100"}`}>Mis pedidos</button>
            )}
            <button onClick={() => setBolsaAbierta(true)} className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100" aria-label={`Mi carrito, ${bolsa.length} pares`}>
              <ShoppingBag size={19} /><span className="hidden sm:inline">Mi carrito</span>
              {bolsa.length > 0 && <span className="absolute top-0.5 left-6 sm:static min-w-5 h-5 px-1 rounded-full bg-purple-700 text-white text-xs leading-5 text-center">{bolsa.length}</span>}
            </button>
            {cuenta ? (
              <button onClick={() => setCuentaAbierta(true)} className="w-9 h-9 rounded-full vx-grad text-white grid place-items-center text-xs font-bold" aria-label="Mi cuenta">
                {cuenta.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </button>
            ) : (
              <Btn size="sm" onClick={() => (vistaPrevia ? toast("En la vista de cliente no se puede ingresar. Aquí el cliente crea su cuenta o entra.") : setAuth({ modo: "entrar" }))}>Ingresar</Btn>
            )}
          </nav>
        </div>
      </header>

      {vista === "pedidos" && cuenta ? (
        <MisPedidos onVolver={() => setVista("catalogo")} toast={toast} recargarCatalogo={cargar} cfg={cfg} destacar={destacar} />
      ) : (
        <>
          <section className="bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute -right-10 -bottom-16 w-72 h-72 opacity-25 pointer-events-none"><Isotipo className="w-full h-full" /></div>
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
              <p className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-cyan-300 mb-2"><MapPin size={14} /> Somos de Cochabamba, Bolivia</p>
              <h1 className="vx-d text-2xl sm:text-5xl font-extrabold leading-tight max-w-2xl">Cada par es único. Se lo lleva el primero que paga.</h1>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-300 max-w-xl">Tenis seleccionados en excelente estado. Recógelos en una paquetería de Cochabamba o te los enviamos a cualquier departamento de Bolivia.</p>
              {cat && <p className="mt-4 text-sm text-cyan-300 font-semibold">{cat.length} pares disponibles ahora</p>}
            </div>
          </section>

          <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 pb-28">
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                <input className={inputCls + " pl-9"} placeholder="Busca por marca, modelo o color" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en el catálogo" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-80">
                <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} options={categorias.map((c) => ({ value: c, label: c === "Todas" ? "Para todos" : c }))} aria-label="Categoría" />
                <Select value={orden} onChange={(e) => setOrden(e.target.value)} options={[{ value: "recientes", label: "Más nuevos" }, { value: "menor", label: "Precio: menor" }, { value: "mayor", label: "Precio: mayor" }]} aria-label="Ordenar" />
              </div>
            </div>
            {tallas.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto vx-noscroll pb-1 mb-4 -mx-3 px-3 sm:mx-0 sm:px-0" role="group" aria-label="Filtrar por talla">
                <span className="text-xs text-slate-500 self-center mr-1 shrink-0">Talla</span>
                {["", ...tallas.map(String)].map((t) => (
                  <button key={t || "todas"} onClick={() => setTalla(t)} aria-pressed={talla === t} className={`shrink-0 min-w-10 px-3 py-1.5 rounded-full text-sm border ${talla === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}>{t ? String(t).replace(".", ",") : "Todas"}</button>
                ))}
              </div>
            )}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-white p-6 text-center">
                <p className="text-sm text-rose-700">{error}</p>
                <Btn variant="outline" className="mt-3" onClick={cargar}><RefreshCw size={15} /> Reintentar</Btn>
              </div>
            ) : !cat ? (
              <div className="py-20 flex justify-center text-slate-500"><span className="flex items-center gap-2 text-sm"><Spinner /> Cargando el catálogo…</span></div>
            ) : !lista.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 px-4 text-center">
                <p className="text-sm text-slate-600">{cat.length ? "No hay pares con esos filtros." : "Estamos preparando pares nuevos. Vuelve pronto."}</p>
                {cat.length > 0 && <Btn variant="outline" className="mt-3" onClick={() => { setQ(""); setTalla(""); setCategoria("Todas"); }}>Ver todo el catálogo</Btn>}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {lista.map((p) => (
                  <article key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                    <div className="relative aspect-square vx-photo">
                      <button className="absolute inset-0" onClick={() => setDetalle(p.id)} aria-label={`Ver ${p.marca} ${p.modelo}`}><ProductPhoto p={p} /></button>
                      {p.videos.length > 0 && <span className="absolute top-2 right-2 pointer-events-none flex items-center gap-1 text-xs font-semibold text-white bg-slate-900/75 rounded-md px-2 py-0.5"><Play size={11} className="fill-white" /> Video</span>}
                      {p.photos.length > 0 && (
                        <button onClick={() => setVisor(p)} className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-semibold text-slate-800 bg-white rounded-md px-2 py-1 shadow" aria-label={`Ver fotos de ${p.marca} ${p.modelo}`}>
                          <ZoomIn size={13} /> {p.photos.length > 1 ? `${p.photos.length} fotos` : "Foto"}
                        </button>
                      )}
                      {enBolsa(p.id) && <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold bg-purple-700 text-white rounded-md px-2 py-0.5"><Check size={12} /> En tu carrito</span>}
                    </div>
                    <button className="text-left px-3 pt-2.5 flex-1" onClick={() => setDetalle(p.id)}>
                      <div className="text-sm font-semibold text-slate-900 truncate">{p.marca} {p.modelo}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">Talla {String(p.talla).replace(".", ",")}{p.cm ? ` · ${fcm(p.cm)}` : ""} · {p.color}</div>
                      <div className="vx-d vx-num text-lg font-bold text-slate-900 mt-1">{bs0(p.precio)}</div>
                    </button>
                    <div className="p-3 pt-2 space-y-1.5">
                      <Btn size="sm" className="w-full" onClick={() => comprarYa(p)}><ShoppingBag size={14} /> Lo compro</Btn>
                      <Btn size="sm" variant="outline" className="w-full" onClick={() => alternar(p)}>
                        {enBolsa(p.id) ? <><Check size={14} /> En tu carrito</> : <><Plus size={14} /> Añadir al carrito</>}
                      </Btn>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6 flex flex-col sm:flex-row gap-2 justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1"><MapPin size={12} /> VORTEX SNEAKERS · Cochabamba, Bolivia · Envíos a todo el país{cfg.whatsapp ? ` · WhatsApp ${cfg.whatsapp}` : ""}</span>
          {!cuenta && !vistaPrevia && <button className="text-left sm:text-right underline" onClick={() => setAuth({ modo: "entrar", motivo: "Si eres parte del equipo, entra con tu correo de trabajo." })}>¿Eres parte del equipo? Ingresa aquí</button>}
        </div>
      </footer>

      {/* Barra inferior en el celular */}
      {bolsa.length > 0 && !bolsaAbierta && !directo && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 p-3 vx-safe-b">
          <Btn className="w-full py-3" onClick={() => setBolsaAbierta(true)}><ShoppingBag size={17} /> Ver mi carrito · {bolsa.length} par{bolsa.length === 1 ? "" : "es"} · {bs0((cat || []).filter((p) => bolsa.includes(p.id)).reduce((a, p) => a + p.precio, 0))}</Btn>
        </div>
      )}
      {cuenta && vista === "catalogo" && bolsa.length === 0 && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 p-3 vx-safe-b">
          <Btn variant="outline" className="w-full" onClick={() => setVista("pedidos")}>Mis pedidos</Btn>
        </div>
      )}

      {pDetalle && <DetallePar p={pDetalle} enBolsa={enBolsa(pDetalle.id)} onAlternar={() => alternar(pDetalle)} onComprar={() => comprarYa(pDetalle)} onFotos={(i) => setVisor({ ...pDetalle, start: i })} onClose={() => setDetalle(null)} />}
      {visor && <PhotoViewer urls={visor.photos.map((f) => f.url)} start={visor.start || 0} title={`${visor.marca} ${visor.modelo}`} onClose={() => setVisor(null)} />}
      {(bolsaAbierta || directo) && (
        <Bolsa
          directo={!!directo}
          pares={directo ? (cat || []).filter((p) => p.id === directo) : (cat || []).filter((p) => bolsa.includes(p.id))} cfg={cfg} cuenta={cuenta}
          onQuitar={(id) => (directo ? setDirecto(null) : setBolsa(bolsa.filter((x) => x !== id)))}
          onClose={() => { setBolsaAbierta(false); setDirecto(null); }}
          onNecesitaCuenta={() => { if (vistaPrevia) { toast("Vista de cliente: aquí el cliente crearía su cuenta y enviaría el pedido. No se envió nada."); return; } try { sessionStorage.setItem("vx-abrir-bolsa", directo ? "d:" + directo : "1"); } catch {} setBolsaAbierta(false); setDirecto(null); setAuth({ modo: "crear", motivo: "Para comprar, crea tu cuenta o ingresa. Tus pares siguen guardados." }); }}
          onEnviado={(pedido) => { if (directo) setBolsa(bolsa.filter((x) => x !== directo)); else setBolsa([]); setBolsaAbierta(false); setDirecto(null); setDestacar(pedido); setVista("pedidos"); window.scrollTo(0, 0); toast(`Pedido ${pedido} creado. Ahora paga con el QR y sube tu comprobante.`); cargar(); }}
          onError={async (msg) => { toast(msg, "err"); await cargar(); }}
        />
      )}
      {auth && <Acceso modo={auth.modo} motivo={auth.motivo} onClose={() => { setAuth(null); try { sessionStorage.removeItem("vx-abrir-bolsa"); } catch {} }} />}
      {cuentaAbierta && cuenta && <MiCuenta cuenta={cuenta} onClose={() => setCuentaAbierta(false)} onSalir={salir} onGuardado={(c) => { onCuentaCambio(c); toast("Datos guardados."); }} onPedidos={() => { setCuentaAbierta(false); setVista("pedidos"); }} />}

      <div className="fixed bottom-20 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-50 space-y-2 sm:max-w-sm" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`flex gap-2 items-start rounded-xl px-4 py-3 shadow-lg text-sm text-white ${t.tone === "err" ? "bg-rose-600" : "bg-slate-900"}`}>
            {t.tone === "err" ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-cyan-300" />}{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function DetallePar({ p, enBolsa, onAlternar, onComprar, onFotos, onClose }) {
  const [i, setI] = useState(0);
  const [video, setVideo] = useState(null);
  return (
    <Modal wide title={`${p.marca} ${p.modelo}`} onClose={onClose} footer={<><Btn variant="outline" onClick={onAlternar}>{enBolsa ? <><Trash2 size={15} /> Quitar del carrito</> : <><Plus size={15} /> Añadir al carrito</>}</Btn><Btn onClick={onComprar}><ShoppingBag size={15} /> Lo compro</Btn></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="relative aspect-square rounded-xl overflow-hidden vx-photo">
            <ProductPhoto p={p} idx={i} fit="contain" />
            {p.photos[i] && <button className="absolute inset-0 cursor-zoom-in" onClick={() => onFotos(i)} aria-label="Ver la foto en pantalla completa" />}
            {p.photos[i] && <span className="absolute top-2 right-2 pointer-events-none flex items-center gap-1 text-xs font-semibold bg-white text-slate-800 rounded-md px-2 py-1 shadow"><ZoomIn size={13} /> Ampliar</span>}
          </div>
          {(p.photos.length > 1 || p.videos.length > 0) && (
            <div className="flex gap-2 mt-2 overflow-x-auto vx-noscroll">
              {p.videos.map((v) => <VideoThumb key={v.id} v={v} onClick={() => setVideo(v)} className="w-20 h-14 shrink-0 rounded-lg" />)}
              {p.photos.length > 1 && p.photos.map((f, n) => (
                <button key={f.id} onClick={() => setI(n)} className={`w-16 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${n === i ? "border-purple-700" : "border-transparent"}`} aria-label={`Foto ${n + 1}`}>
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {p.videos.length > 0 && <button onClick={() => setVideo(p.videos[0])} className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><Play size={15} className="fill-slate-800" /> Ver video{p.videos.length > 1 ? `s (${p.videos.length})` : ""}</button>}
          {video && <VideoPlayer url={video.url} title={`${p.marca} ${p.modelo}`} onClose={() => setVideo(null)} />}
        </div>
        <div className="space-y-4">
          <div>
            <div className="vx-d vx-num text-3xl font-extrabold text-slate-900">{bs0(p.precio)}</div>
            <div className="text-xs text-slate-500 mt-1">Código {p.codigo} · par único</div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {[["Talla", String(p.talla).replace(".", ",")], ["Largo", fcm(p.cm) || "—"], ["Color", p.color], ["Estado", p.estadoFisico], ["Para", p.categoria]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold text-slate-900">{v}</dd></div>
            ))}
          </dl>
          {p.descripcion && <p className="text-sm text-slate-600 leading-relaxed">{p.descripcion}</p>}
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
            <div className="flex gap-2"><Package size={14} className="shrink-0 text-slate-400" /> Recógelo en una paquetería de Cochabamba</div>
            <div className="flex gap-2"><Truck size={14} className="shrink-0 text-slate-400" /> Envío a todos los departamentos de Bolivia</div>
            <div className="flex gap-2"><QrCode size={14} className="shrink-0 text-slate-400" /> Pagas con QR y subes tu comprobante</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Bolsa({ directo = false, pares, cfg, cuenta, onQuitar, onClose, onNecesitaCuenta, onEnviado, onError }) {
  const [modo, setModo] = useState("cochabamba");
  const [destino, setDestino] = useState("");
  const [otroDestino, setOtroDestino] = useState("");
  const [recibe, setRecibe] = useState(cuenta?.nombre || "");
  const [ci, setCi] = useState("");
  const [nota, setNota] = useState("");
  const [busy, run] = useBusy();
  const total = pares.reduce((a, p) => a + p.precio, 0);
  const destinoFinal = destino === "__otro" ? otroDestino.trim() : destino;
  const falta = !pares.length ? "Agrega al menos un par." : modo === "envio" && !destinoFinal ? "Elige o escribe a dónde se envía." : cuenta && !recibe.trim() ? "Escribe el nombre de quien recoge." : cuenta && ci.trim().length < 4 ? "Escribe el carnet (CI) de quien recoge." : "";
  const enviar = () => run(async () => {
    if (!cuenta) { onNecesitaCuenta(); return; }
    const { data, error } = await supabase.rpc("cliente_pedir", {
      p_productos: pares.map((p) => p.id), p_tipo: "Compra",
      p_envio: { modo, destino: modo === "envio" ? destinoFinal : "Cochabamba", recibe, ci },
      p_nota: nota,
    });
    if (error) { onError(mensajeError(error)); return; }
    onEnviado(data);
  });
  return (
    <Modal wide title={directo ? "Comprar este par" : "Mi carrito"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>{directo ? "Cancelar" : "Seguir viendo"}</Btn>
      <Btn disabled={busy || !!falta} onClick={enviar}>{busy ? <Spinner /> : <ShoppingBag size={15} />} {cuenta ? "Comprar" : "Continuar"}</Btn>
    </>}>
      {!pares.length ? (
        <div className="py-8 text-center text-sm text-slate-500">Tu carrito está vacío. Toca <b>Añadir al carrito</b> en los pares que te gusten, o <b>Lo compro</b> para comprar uno directo.</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {pares.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5">
                <div className="w-14 h-14 rounded-lg overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{p.marca} {p.modelo}</div><div className="text-xs text-slate-500">Talla {String(p.talla).replace(".", ",")}{p.cm ? ` · ${fcm(p.cm)}` : ""} · {p.color}</div></div>
                <span className="vx-num text-sm font-semibold">{bs0(p.precio)}</span>
                <button className="p-1.5 text-slate-400 hover:text-rose-600" onClick={() => onQuitar(p.id)} aria-label={`Quitar ${p.marca} ${p.modelo}`}><X size={16} /></button>
              </div>
            ))}
            <div className="flex justify-between p-3 text-sm font-semibold vx-num"><span>Total de los pares</span><span>{bs0(total)}</span></div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5">¿Cómo lo recibes?</div>
            <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Entrega">
              {ENTREGAS.map(({ k, titulo, desc, icon: I }) => (
                <button key={k} type="button" role="radio" aria-checked={modo === k} onClick={() => setModo(k)} className={`text-left rounded-xl border p-3 ${modo === k ? "border-purple-700 ring-1 ring-purple-700 bg-purple-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <I size={18} className={modo === k ? "text-purple-700" : "text-slate-400"} />
                  <span className="block text-sm font-semibold text-slate-900 mt-1">{titulo}</span><span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          {modo === "cochabamba" && cfg.paqueteria && <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700 flex gap-2"><MapPin size={14} className="shrink-0 text-slate-400" /><span>Recoges en: <b>{cfg.paqueteria}</b></span></div>}
          {modo === "envio" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="¿A dónde lo enviamos?">
                <Select value={destino} onChange={(e) => setDestino(e.target.value)} options={[{ value: "", label: "Elige el lugar" }, ...cfg.destinos.filter((d) => d !== "Cochabamba").map((d) => ({ value: d, label: d })), { value: "__otro", label: "Otra ciudad o provincia" }]} />
              </Field>
              {destino === "__otro" && <Field label="Escribe el lugar"><Input value={otroDestino} maxLength={80} placeholder="Ej.: Punata, Montero, Riberalta" onChange={(e) => setOtroDestino(e.target.value)} /></Field>}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nombre de quien recoge"><Input value={recibe} maxLength={100} autoComplete="name" placeholder="Nombre completo" onChange={(e) => setRecibe(e.target.value)} /></Field>
            <Field label="Carnet de identidad (CI)" hint="Te lo pedirán en la paquetería para entregarte."><Input value={ci} maxLength={30} placeholder="Ej.: 1234567 CB" onChange={(e) => setCi(e.target.value)} /></Field>
          </div>
          <Field label="Nota para nosotros (opcional)"><Input value={nota} maxLength={300} placeholder="Algo que debamos saber" onChange={(e) => setNota(e.target.value)} /></Field>
          <div className="rounded-xl bg-purple-50 p-3 text-xs text-purple-900 flex gap-2"><QrCode size={16} className="shrink-0 text-purple-700" /><span>Al tocar <b>Comprar</b> pasas directo a pagar con el QR. <b>No apartamos pares:</b> se lo lleva quien pague primero y suba su comprobante. Cuando verifiquemos el pago, te avisamos la fecha de envío.{modo === "envio" ? " El costo de la encomienda lo pagas al recoger." : ""}</span></div>
          {!cuenta && <div className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-900 flex gap-2"><User size={16} className="shrink-0 mt-0.5" /> Para comprar necesitas una cuenta. Te pediremos tu nombre, teléfono y correo; tus pares siguen guardados.</div>}
          {falta && pares.length > 0 && <p className="text-xs text-amber-700">{falta}</p>}
          <Contacto cfg={cfg} pedido="" mensaje={`Hola VORTEX SNEAKERS, tengo una duda sobre ${pares.map((p) => `${p.marca} ${p.modelo} (${p.codigo})`).join(", ")}.`} texto="¿Tienes alguna duda? Escríbenos" />
        </>
      )}
    </Modal>
  );
}

function Acceso({ modo: modoInicial, motivo, onClose }) {
  const [modo, setModo] = useState(modoInicial || "entrar");
  const [f, setF] = useState({ nombre: "", telefono: "", zona: "Cercado", direccion: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const entrar = () => run(async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    if (error) setErr(mensajeError(error));
  });
  const crear = () => run(async () => {
    setErr("");
    const { error } = await supabase.rpc("registrar_cuenta_cliente", {
      p_email: f.email.trim(), p_password: f.password, p_nombre: f.nombre.trim(), p_telefono: f.telefono, p_zona: f.zona, p_direccion: f.direccion,
    });
    if (error) { setErr(mensajeError(error)); return; }
    const r = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    if (r.error) setErr(mensajeError(r.error));
  });
  const okEntrar = f.email.trim() && f.password;
  const okCrear = okEntrar && f.nombre.trim() && f.telefono.replace(/\D/g, "").length >= 7 && f.password.length >= 6;
  return (
    <Modal title={modo === "entrar" ? "Ingresar" : "Crear mi cuenta"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      {modo === "entrar"
        ? <Btn disabled={busy || !okEntrar} onClick={entrar}>{busy ? <Spinner /> : null} Ingresar</Btn>
        : <Btn disabled={busy || !okCrear} onClick={crear}>{busy ? <Spinner /> : null} Crear cuenta</Btn>}
    </>}>
      <form onSubmit={(e) => { e.preventDefault(); modo === "entrar" ? okEntrar && entrar() : okCrear && crear(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-lg p-1" role="tablist">
          {[["entrar", "Ya tengo cuenta"], ["crear", "Soy nuevo"]].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => { setModo(k); setErr(""); }} className={`text-sm py-1.5 rounded-md ${modo === k ? "bg-white shadow-sm font-semibold text-slate-900" : "text-slate-500"}`}>{l}</button>)}
        </div>
        {motivo && <p className="text-sm text-slate-600">{motivo}</p>}
        {modo === "crear" && (
          <>
            <Field label="Nombre completo"><Input value={f.nombre} autoComplete="name" onChange={set("nombre")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Celular (WhatsApp)"><Input type="tel" inputMode="tel" autoComplete="tel" placeholder="7xxxxxxx" value={f.telefono} onChange={set("telefono")} /></Field>
              <Field label="Ciudad o zona">
                <input className={inputCls} list="vx-zonas" value={f.zona} onChange={set("zona")} />
                <datalist id="vx-zonas">{ZONAS.map((z) => <option key={z} value={z} />)}</datalist>
              </Field>
            </div>
            
          </>
        )}
        <Field label="Correo"><Input type="email" inputMode="email" autoComplete={modo === "entrar" ? "username" : "email"} value={f.email} onChange={set("email")} /></Field>
        <Field label={modo === "crear" ? "Crea una contraseña (mínimo 6 caracteres)" : "Contraseña"}>
          <PasswordInput value={f.password} onChange={set("password")} autoComplete={modo === "crear" ? "new-password" : "current-password"} />
        </Field>
        {err && <p className="text-sm text-rose-600 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{err}</p>}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function MiCuenta({ cuenta, onClose, onSalir, onGuardado, onPedidos }) {
  const [f, setF] = useState({ nombre: cuenta.nombre, zona: cuenta.zona, direccion: cuenta.direccion });
  const [busy, run] = useBusy();
  const [err, setErr] = useState("");
  const guardarDatos = () => run(async () => {
    setErr("");
    const { error } = await supabase.rpc("cliente_actualizar", { p_nombre: f.nombre, p_zona: f.zona, p_direccion: f.direccion });
    if (error) { setErr(mensajeError(error)); return; }
    onGuardado({ ...cuenta, ...f });
    onClose();
  });
  return (
    <Modal title="Mi cuenta" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onSalir}><LogOut size={15} /> Cerrar sesión</Btn>
      <Btn disabled={busy || !f.nombre.trim()} onClick={guardarDatos}>{busy ? <Spinner /> : null} Guardar</Btn>
    </>}>
      <button onClick={onPedidos} className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold hover:bg-slate-50">Mis pedidos <ChevronRight size={16} className="text-slate-400" /></button>
      <Field label="Nombre completo"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><div className="text-xs text-slate-500">Celular</div><div className="font-medium">{cuenta.telefono}</div></div>
        <div className="min-w-0"><div className="text-xs text-slate-500">Correo</div><div className="font-medium truncate">{cuenta.email}</div></div>
      </div>
      <Field label="Ciudad o zona">
        <input className={inputCls} list="vx-zonas-cuenta" value={f.zona} onChange={(e) => setF({ ...f, zona: e.target.value })} />
        <datalist id="vx-zonas-cuenta">{ZONAS.map((z) => <option key={z} value={z} />)}</datalist>
      </Field>
      <Field label="Dirección"><Input value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></Field>
      <p className="text-xs text-slate-500">Para cambiar tu celular, escríbenos por WhatsApp.</p>
      {err && <p className="text-sm text-rose-600">{err}</p>}
    </Modal>
  );
}

const textoEntrega = (e) => {
  if (!e?.entrega) return "";
  if (e.modo === "cochabamba") return "Recojo en paquetería de Cochabamba";
  if (e.entrega === "Recojo en punto") return "Recoges en tienda (Cochabamba)";
  if (e.entrega === "Delivery Cochabamba") return `Envío a: ${e.direccion}`;
  return `Envío a ${e.destino}${e.transportista ? ` por ${e.transportista}` : ""}`;
};
const ETAPAS_LISTO = ["Listo para entregar", "Enviado", "Entregado"];

/** Estado de un pedido completo (todos sus pares) para mostrar el seguimiento */
function estadoPedido(items) {
  const porPagar = items.filter((x) => x.estado === "Por pagar");
  const libres = porPagar.filter((x) => x.disponible);
  const apartados = items.filter((x) => x.estado === "Activa"); // con comprobante en revisión
  const conVenta = items.find((x) => x.venta && x.venta.estado === "Activa");
  const v = conVenta?.venta || null;
  const comp = items.find((x) => x.comprobante)?.comprobante || null;
  const cancelado = !porPagar.length && !apartados.length && !v;
  return { porPagar, libres, apartados, v, comp, cancelado, envio: items[0].envio || {}, vence: porPagar[0]?.vence };
}

const waTienda = (tel, texto) => `https://wa.me/${String(tel).startsWith("591") || String(tel).startsWith("+") ? String(tel).replace("+", "") : "591" + tel}?text=${encodeURIComponent(texto)}`;
function Contacto({ cfg, pedido, texto = "¿Tienes dudas? Escríbenos", mensaje = "" }) {
  if (!cfg?.whatsapp) return null;
  return (
    <a href={waTienda(cfg.whatsapp, mensaje || `Hola VORTEX SNEAKERS, les escribo por mi pedido ${pedido}.`)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-sm text-cyan-900 hover:bg-cyan-100">
      <span>{texto} por WhatsApp: <b>{cfg.whatsapp}</b></span><ChevronRight size={16} />
    </a>
  );
}

function Seguimiento({ est }) {
  const { v, comp, envio } = est;
  const enCbba = envio.modo === "cochabamba";
  const etapa = v?.entrega || "";
  const pasos = [
    { t: "Pedido recibido", ok: true },
    { t: v ? "Pago aprobado" : comp?.estado === "En revisión" ? "Pago en revisión" : "Pago", ok: !!v, sub: !v ? (comp?.estado === "En revisión" ? "Estamos verificando" : "Esperando tu pago") : "" },
    { t: "Preparando", ok: ETAPAS_LISTO.includes(etapa) },
    { t: enCbba ? "En la paquetería" : "Enviado", ok: etapa === "Enviado" || etapa === "Entregado", sub: v?.fecha_envio && !(etapa === "Enviado" || etapa === "Entregado") ? `Fecha: ${fdate(v.fecha_envio)}` : "" },
    { t: enCbba ? "Recogido" : "Entregado", ok: etapa === "Entregado" },
  ];
  const actual = pasos.findIndex((p) => !p.ok);
  return (
    <ol className="flex items-start px-2 pt-4 pb-3" aria-label="Seguimiento del pedido">
      {pasos.map((p, i) => (
        <li key={i} className="flex-1 flex flex-col items-center text-center relative" aria-current={i === actual ? "step" : undefined}>
          {i > 0 && <span className={`absolute top-3 right-1/2 w-full h-0.5 ${p.ok || i === actual ? "bg-cyan-500" : "bg-slate-200"}`} />}
          <span className={`relative z-10 w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${p.ok ? "bg-cyan-500 text-white" : i === actual ? "bg-purple-700 text-white" : "bg-slate-200 text-slate-500"}`}>{p.ok ? <Check size={13} /> : i + 1}</span>
          <span className={`text-[11px] sm:text-xs mt-1 leading-tight px-0.5 ${i === actual ? "font-semibold text-slate-900" : "text-slate-500"}`}>{p.t}</span>
          {p.sub && <span className="text-[10px] sm:text-[11px] text-purple-700 leading-tight mt-0.5">{p.sub}</span>}
        </li>
      ))}
    </ol>
  );
}

// Sube un archivo a la carpeta privada del cliente y devuelve su ruta (o un mensaje de error)
async function subirArchivoComprobante(file, pedido) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { error: "Vuelve a iniciar sesión e inténtalo otra vez." };
  const esImagen = /^image\/(jpeg|png|webp)$/.test(file.type);
  const blob: any = esImagen && file.size > 1.5 * 1024 * 1024 ? await comprimirImagen(file, 1800, 0.85) : file;
  if (blob.size > 8 * 1024 * 1024) return { error: `“${file.name}” es muy pesado (máximo 8 MB). Sube una captura de pantalla.` };
  const ext = blob !== file ? "jpg" : (String(file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const ruta = `${uid}/${pedido}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const up = await supabase.storage.from(BUCKET_COMPROBANTES).upload(ruta, blob, { contentType: blob.type || file.type || "image/jpeg", upsert: false });
  if (up.error) return { error: "No se pudo subir el comprobante. Revisa tu conexión e inténtalo otra vez." };
  return { ruta };
}

function Miniatura({ file, onQuitar }) {
  const [vista, setVista] = useState("");
  useEffect(() => { if (!/^image\//.test(file.type)) return; const u = URL.createObjectURL(file); setVista(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <div className="relative w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center overflow-hidden shrink-0">
      {vista ? <img src={vista} alt={file.name} className="w-full h-full object-cover" /> : <FileText size={22} className="text-slate-400" />}
      {onQuitar && <button onClick={onQuitar} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-slate-900/70 text-white grid place-items-center" aria-label={`Quitar ${file.name}`}><X size={12} /></button>}
    </div>
  );
}

function BotonesArchivo({ onFiles, varios = true }) {
  const elegir = (e) => { const fs = Array.from(e.target.files || []) as File[]; e.target.value = ""; if (fs.length) onFiles(fs); };
  return (
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"><Camera size={15} /> Tomar foto<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={elegir} /></label>
      <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"><Upload size={15} /> {varios ? "Elegir capturas o PDF" : "Elegir captura o PDF"}<input type="file" accept="image/*,application/pdf" multiple={varios} className="sr-only" onChange={elegir} /></label>
    </div>
  );
}

function SubirComprobante({ pedido, total, varios = false, toast, onListo }) {
  const [files, setFiles] = useState([]);
  const [monto, setMonto] = useState(total ? String(total) : "");
  const [busy, run] = useBusy();
  const agregar = (fs) => setFiles((a) => [...a, ...fs].slice(0, 6));
  const enviar = () => run(async () => {
    const rutas = [];
    for (const f of files) {
      const r = await subirArchivoComprobante(f, pedido);
      if (r.error) { if (rutas.length) await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas); toast(r.error, "err"); return; }
      rutas.push(r.ruta);
    }
    const { data: res, error } = await supabase.rpc("cliente_subir_comprobante", { p_pedido: pedido, p_rutas: rutas, p_monto: monto === "" ? null : Number(monto) });
    if (error) { await supabase.storage.from(BUCKET_COMPROBANTES).remove(rutas); toast(mensajeError(error), "err"); return; }
    if (res?.perdidos > 0) toast(res.apartados ? `Recibimos tu pago. ${res.perdidos === 1 ? "Un par lo pagó" : `${res.perdidos} pares los pagó`} otra persona antes; te contactaremos por la diferencia.` : "Recibimos tu pago, pero otra persona pagó antes esos pares. Te contactaremos para devolverte tu dinero.", "err");
    else toast("¡Listo! Tus pares quedaron apartados. Te avisamos cuando verifiquemos el pago.");
    setFiles([]);
    onListo();
  });
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
      <div className="text-sm font-semibold text-slate-900">Sube tu comprobante de pago</div>
      {varios && <p className="text-xs text-slate-600">Si pagaste con varios QR, sube <b>un comprobante por cada pago</b> (hasta 6).</p>}
      <div className="flex flex-wrap gap-2 items-center">
        {files.map((f, i) => <Miniatura key={i + f.name} file={f} onQuitar={() => setFiles(files.filter((_, j) => j !== i))} />)}
        {!files.length && <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center"><Upload size={22} className="text-slate-300" /></div>}
      </div>
      {files.length < 6 && <BotonesArchivo onFiles={agregar} />}
      {files.length > 0 && <div className="text-xs text-slate-500">{files.length} comprobante{files.length === 1 ? "" : "s"} listo{files.length === 1 ? "" : "s"} para enviar. Puedes agregar más.</div>}
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label={varios ? "Total que pagaste (Bs)" : "Monto que pagaste (Bs)"}><Input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field></div>
        <Btn disabled={busy || !files.length} onClick={enviar}>{busy ? <Spinner /> : <Upload size={15} />} Enviar{files.length > 1 ? ` (${files.length})` : ""}</Btn>
      </div>
    </div>
  );
}

// Mientras el pago está en revisión: agregar un comprobante que faltó
function AgregarComprobante({ pedido, toast, onListo }) {
  const [abierto, setAbierto] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, run] = useBusy();
  const enviar = () => run(async () => {
    const r = await subirArchivoComprobante(file, pedido);
    if (r.error) { toast(r.error, "err"); return; }
    const { error } = await supabase.rpc("cliente_agregar_comprobante", { p_pedido: pedido, p_ruta: r.ruta, p_monto: null });
    if (error) { await supabase.storage.from(BUCKET_COMPROBANTES).remove([r.ruta]); toast(mensajeError(error), "err"); return; }
    toast("Agregamos tu comprobante al pago en revisión.");
    setFile(null); setAbierto(false); onListo();
  });
  if (!abierto) return <button className="text-sm font-semibold text-purple-700 flex items-center gap-1" onClick={() => setAbierto(true)}><Plus size={15} /> Agregar otro comprobante</button>;
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
      <div className="text-sm font-semibold text-slate-900">Agregar otro comprobante</div>
      <div className="flex items-center gap-3">{file ? <Miniatura file={file} onQuitar={() => setFile(null)} /> : <BotonesArchivo varios={false} onFiles={(fs) => setFile(fs[0])} />}</div>
      <div className="flex justify-end gap-2"><Btn size="sm" variant="ghost" onClick={() => { setAbierto(false); setFile(null); }}>Cancelar</Btn><Btn size="sm" disabled={busy || !file} onClick={enviar}>{busy ? <Spinner /> : null} Enviar</Btn></div>
    </div>
  );
}

function MisPedidos({ onVolver, toast, recargarCatalogo, cfg, destacar = "" }) {
  const [lista, setLista] = useState(null);
  const [qrAbierto, setQrAbierto] = useState(null);
  const [err, setErr] = useState("");
  const [busy, run] = useBusy();
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("cliente_mis_pedidos");
    if (error) { setErr(mensajeError(error)); return; }
    setErr(""); setLista(data || []);
  }, []);
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, [cargar]);
  const grupos = useMemo(() => {
    const o = new Map();
    (lista || []).forEach((x) => { const k = x.pedido || x.reserva; if (!o.has(k)) o.set(k, []); o.get(k).push(x); });
    return [...o.entries()];
  }, [lista]);
  const cancelar = (x) => run(async () => {
    if (!confirm(`¿Quitar ${x.par.marca} ${x.par.modelo} de tu pedido?`)) return;
    const { error } = await supabase.rpc("cliente_cancelar", { p_reserva: x.reserva });
    if (error) { toast(mensajeError(error), "err"); return; }
    toast("Listo, lo quitamos de tu pedido.");
    await cargar(); recargarCatalogo();
  });
  const subido = async () => { await cargar(); recargarCatalogo(); };
  return (
    <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h1 className="vx-d text-2xl font-bold text-slate-900">Mis pedidos</h1>
        <Btn variant="outline" size="sm" onClick={onVolver}>Ver catálogo</Btn>
      </div>
      {err ? <p className="text-sm text-rose-600">{err}</p> : !lista ? (
        <div className="py-16 flex justify-center text-slate-500"><span className="flex items-center gap-2 text-sm"><Spinner /> Cargando tus pedidos…</span></div>
      ) : !grupos.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 px-4 text-center">
          <p className="text-sm text-slate-600">Todavía no hiciste pedidos.</p>
          <Btn className="mt-3" onClick={onVolver}>Ver el catálogo</Btn>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(([k, items]) => {
            const est = estadoPedido(items);
            const { v, comp, porPagar, libres, apartados } = est;
            const saldo = v ? Math.max(0, Number(v.total) - Number(v.pagado)) : 0;
            const porCobrar = libres.reduce((a, x) => a + Number(x.par.precio || 0), 0);
            const enRevision = comp?.estado === "En revisión" && apartados.length > 0;
            const rechazado = est.cancelado && comp?.estado === "Rechazado";
            return (
              <section key={k} ref={(el) => { if (el && k === destacar) setTimeout(() => el.scrollIntoView({ block: "start" }), 50); }} className={`bg-white rounded-xl border overflow-hidden ${k === destacar ? "border-purple-400 ring-2 ring-purple-200" : "border-slate-200"}`}>
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div><div className="text-sm font-semibold text-slate-900">Pedido {k}</div><div className="text-xs text-slate-500">{fdate(items[0].creado)}</div></div>
                  <div className="text-xs text-slate-600 flex items-center gap-1"><MapPin size={12} />{textoEntrega(est.envio)}</div>
                </div>
                {est.cancelado ? (
                  <div className="px-4 py-2.5 text-sm text-slate-600 bg-slate-50 flex items-center gap-2"><Pill tone="Cancelada">Cancelado</Pill>{!rechazado && items[0].obs && <span className="text-xs">{items[0].obs}</span>}</div>
                ) : <Seguimiento est={est} />}
                {v && (v.fecha_envio || v.guia) && (
                  <div className="mx-4 mb-3 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-900 flex flex-wrap gap-x-4 gap-y-0.5">
                    {v.fecha_envio && <span><Truck size={13} className="inline -mt-0.5 mr-1" />{est.envio.modo === "cochabamba" ? "Lo dejamos en la paquetería el" : "Fecha de envío:"} <b>{fdate(v.fecha_envio)}</b></span>}
                    {v.guia && <span>N.º de guía: <b>{v.guia}</b></span>}
                  </div>
                )}
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {items.map((x) => {
                    const vendido = x.estado === "Por pagar" && !x.disponible;
                    return (
                      <div key={x.reserva} className="flex items-center gap-3 p-3">
                        <div className={`w-14 h-14 rounded-lg overflow-hidden vx-photo shrink-0 ${x.estado === "Cancelada" || vendido ? "opacity-50" : ""}`}>
                          <ProductPhoto p={{ codigo: x.par.codigo, marca: x.par.marca, modelo: x.par.modelo, hex: colorHex(x.par.color), photos: x.par.foto ? [{ id: x.par.foto, url: fotoUrl(x.par.foto) }] : [] }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${x.estado === "Cancelada" || vendido ? "text-slate-400 line-through" : ""}`}>{x.par.marca} {x.par.modelo}</div>
                          <div className="text-xs text-slate-500">Talla {String(x.par.talla).replace(".", ",")}{x.par.cm ? ` · ${fcm(x.par.cm)}` : ""} · {bs0(x.par.precio)}</div>
                          {vendido && <div className="text-xs text-rose-600 font-medium">Ya lo compró otra persona. No lo pagues.</div>}
                          {x.estado === "Cancelada" && x.obs && !rechazado && !est.cancelado && <div className="text-xs text-rose-600">{x.obs}</div>}
                        </div>
                        {x.estado === "Por pagar" && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => cancelar(x)}>Quitar</Btn>}
                      </div>);
                  })}
                </div>
                {v && v.estado !== "Anulada" && (
                  <div className="px-4 py-3 bg-slate-50 text-sm vx-num flex flex-wrap gap-x-6 gap-y-1">
                    <span>Total <b>{bs0(v.total)}</b></span><span>Pagado <b className="text-cyan-700">{bs0(v.pagado)}</b></span>{saldo > 0 && <span>Falta pagar <b className="text-rose-600">{bs0(saldo)}</b></span>}
                  </div>
                )}
                <div className="px-4 py-3 border-t border-slate-100 space-y-3 empty:hidden">
                  {enRevision && <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900 flex gap-2"><Clock size={16} className="shrink-0 mt-0.5" /><span><b>Pago en revisión.</b> Recibimos {comp.n > 1 ? `${comp.n} comprobantes` : "tu comprobante"}{comp.monto ? ` (total ${bs0(comp.monto)})` : ""}. Tus pares ya están apartados para ti.</span></div>}
                  {enRevision && (comp.n || 0) < 6 && <AgregarComprobante pedido={k} toast={toast} onListo={cargar} />}
                  {rechazado && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-800 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span><b>No pudimos aprobar tu pago:</b> {comp.motivo}. Los pares volvieron al catálogo.</span></div>}
                  {v && comp?.estado === "Aprobado" && <div className="rounded-xl bg-cyan-50 border border-cyan-200 px-3 py-2.5 text-sm text-cyan-900 flex gap-2"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /><span><b>¡Pago aprobado!</b> Tu compra está confirmada. Aquí verás cada paso de tu envío.</span></div>}
                  {(enRevision || rechazado || (v && comp)) && <Contacto cfg={cfg} pedido={k} texto={rechazado ? "Escríbenos" : "¿Dudas sobre tu pedido? Escríbenos"} />}
                  {porPagar.length > 0 && !enRevision && (libres.length ? (
                    <>
                      <p className="text-xs text-slate-600 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" /> Los pares no están apartados: se los lleva quien pague primero. Paga y sube tu comprobante cuanto antes (este pedido se cancela el {ftime(est.vence)}).</p>
                      {(() => {
                        const qt = libres[0]?.qr_total;
                        const sinQr = libres.some((x) => !x.qr);
                        if (qt && (libres.length > 1 || sinQr)) return (
                          <>
                            <button onClick={() => setQrAbierto({ ruta: qt.ruta, monto: qt.monto, nombre: qt.nombre, pares: libres.map((x) => x.par), total: Number(qt.total), todo: true })} className="w-full flex items-center gap-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3 py-3 text-left">
                              <span className="w-10 h-10 rounded-lg bg-white grid place-items-center text-purple-700 shrink-0"><QrCode size={22} /></span>
                              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">Pagar todo con un QR · {bs0(qt.total)}</span><span className="block text-xs text-purple-100">{libres.length > 1 ? `Los ${libres.length} pares en un solo pago` : "Paga tu par con este QR"}</span></span>
                              <ChevronRight size={18} />
                            </button>
                            {libres.length > 1 && !sinQr && <details className="text-sm"><summary className="cursor-pointer text-xs font-semibold text-slate-600 py-1">O paga cada par por separado</summary><div className="pt-2"><PagosQr items={libres} onAbrir={setQrAbierto} /></div></details>}
                          </>
                        );
                        return <PagosQr items={libres} onAbrir={setQrAbierto} />;
                      })()}
                      <SubirComprobante pedido={k} total={porCobrar} varios={new Set(libres.map((x) => x.qr?.ruta || x.reserva)).size > 1} toast={toast} onListo={subido} />
                    </>
                  ) : (
                    <p className="text-sm text-rose-700">Los pares de este pedido ya los compró otra persona. Quítalos y elige otros en el catálogo.</p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {qrAbierto && <PagarQr qr={qrAbierto} onClose={() => setQrAbierto(null)} toast={toast} />}
    </main>
  );
}

// Junta los pares de un pedido que usan el mismo QR (por ejemplo, dos pares de Bs 180 → un solo QR)
function PagosQr({ items, onAbrir }) {
  const qrs = new Map();
  items.filter((x) => x.qr && x.qr.ruta).forEach((x) => {
    const k = x.qr.ruta;
    if (!qrs.has(k)) qrs.set(k, { ...x.qr, pares: [] });
    qrs.get(k).pares.push(x.par);
  });
  if (!qrs.size) return null;
  return (
    <div className="space-y-2">
      {[...qrs.values()].map((q) => (
        <button key={q.ruta} onClick={() => onAbrir(q)} className="w-full flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-2.5 text-left">
          <span className="w-10 h-10 rounded-lg bg-white grid place-items-center text-purple-700 shrink-0"><QrCode size={22} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-purple-900">Pagar con QR{q.monto ? ` · ${bs0(q.monto)}` : ""}</span>
            <span className="block text-xs text-purple-800 truncate">{q.pares.length === 1 ? `${q.pares[0].marca} ${q.pares[0].modelo}` : `Para ${q.pares.length} pares: paga una vez por cada par`}</span>
          </span>
          <ChevronRight size={18} className="text-purple-700" />
        </button>
      ))}
    </div>
  );
}

function PagarQr({ qr, onClose, toast }) {
  const url = fotoUrl(qr.ruta);
  const [busy, run] = useBusy();
  const descargar = () => run(async () => {
    try {
      const b = await (await fetch(url)).blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = u; a.download = `QR-VORTEX${qr.monto ? "-" + Math.round(qr.monto) : ""}.${(b.type.split("/")[1] || "png").replace("jpeg", "jpg")}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch { toast("No se pudo descargar. Mantén presionada la imagen para guardarla.", "err"); }
  });
  const n = qr.pares.length;
  return (
    <Modal title="Pagar con QR" onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn disabled={busy} onClick={descargar}>{busy ? <Spinner /> : <Download size={15} />} Guardar QR</Btn></>}>
      <div className="rounded-xl bg-white border border-slate-200 p-3"><img src={url} alt="Código QR para pagar" className="w-full max-h-96 object-contain" /></div>
      {qr.todo ? (
        qr.monto ? <div className="text-center"><div className="text-xs text-slate-500">Monto a pagar ({n === 1 ? "tu par" : `los ${n} pares`})</div><div className="vx-d text-3xl font-bold text-slate-900">{bs0(qr.monto)}</div></div>
          : <div className="text-center"><div className="text-xs text-slate-500">Escribe en tu banco el total{n > 1 ? ` de los ${n} pares` : ""}</div><div className="vx-d text-3xl font-bold text-slate-900">{bs0(qr.total)}</div></div>
      ) : qr.monto ? (
        <div className="text-center"><div className="text-xs text-slate-500">Monto a pagar{n > 1 ? " por cada par" : ""}</div><div className="vx-d text-3xl font-bold text-slate-900">{bs0(qr.monto)}</div>{n > 1 && <div className="text-xs text-slate-500">Son {n} pares: paga {n} veces o un total de <b>{bs0(qr.monto * n)}</b> si tu banco permite cambiar el monto.</div>}</div>
      ) : (
        <div className="text-center text-sm text-slate-600">Escribe en tu banco el monto del par: <b>{qr.pares.map((p) => bs0(p.precio)).join(" + ")}</b></div>
      )}
      <ol className="text-sm text-slate-700 space-y-1.5 list-decimal pl-5">
        <li>Abre la app de tu banco y elige <b>Pagar con QR</b>.</li>
        <li>Escanea este código o súbelo desde tu galería (toca <b>Guardar QR</b>).</li>
        <li>Guarda la captura del comprobante y súbela en tu pedido, en <b>Sube tu comprobante de pago</b>.</li>
      </ol>
    </Modal>
  );
}
