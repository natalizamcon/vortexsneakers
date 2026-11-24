// Tienda en línea de VORTEX SNEAKERS: catálogo público, cuenta de cliente y pedidos.
// Aquí NUNCA se leen tablas internas: todo llega de funciones que solo devuelven datos de compra.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag, Search, X, ZoomIn, Check, Plus, Trash2, Store, Truck, Package, Clock, LogOut, User,
  CheckCircle2, AlertTriangle, ChevronRight, MapPin, RefreshCw, QrCode, Download, Eye, ArrowLeft, Upload, Camera, FileText,
} from "lucide-react";
import { supabase, fotoUrl, mensajeError, comprimirImagen, BUCKET_COMPROBANTES } from "../lib/supabase";
import { bs0, fcm, colorHex, norm, ftime, fdate, DEPARTAMENTOS } from "../lib/utils";
import { Logo, Isotipo, Btn, Field, Input, Select, inputCls, Modal, PasswordInput, ProductPhoto, Spinner, Pill, useBusy } from "../components/ui";
import { PhotoViewer } from "../components/photos";

const BOLSA_KEY = "vx-bolsa";
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// Solo dos formas de entrega, siempre por paquetería
const ENTREGAS = [
  { k: "cochabamba", titulo: "Paquetería en Cochabamba", desc: "Lo dejamos en una paquetería de Cochabamba y lo recoges ahí.", icon: Package },
  { k: "envio", titulo: "Envío a provincias u otro país", desc: "Lo enviamos por encomienda a tu ciudad, provincia o país.", icon: Truck },
];
const ZONAS = ["Cercado", "Sacaba", "Quillacollo", "Tiquipaya", "Colcapirhua", "Vinto", "Sipe Sipe", ...DEPARTAMENTOS];

/** Convierte un par del catálogo público al formato que usan las fotos de la app */
const aPar = (x) => ({
  ...x, precio: Number(x.precio) || 0, talla: Number(x.talla), cm: x.cm == null ? null : Number(x.cm),
  estadoFisico: x.estado_fisico, hex: colorHex(x.color),
  photos: (x.fotos || []).map((ruta) => ({ id: ruta, url: fotoUrl(ruta) })),
});

export function Tienda({ cuenta, onCuentaCambio, vistaPrevia = false, onSalirVista = () => {} }) {
  // En la vista previa del equipo, la lista de pares se guarda aparte para no mezclarla
  const llaveBolsa = vistaPrevia ? BOLSA_KEY + "-vista" : BOLSA_KEY;
  const [cat, setCat] = useState(null);
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState({ destinos: DEPARTAMENTOS, vigencia_horas: 48 });
  const [vista, setVista] = useState("catalogo");
  const [q, setQ] = useState("");
  const [talla, setTalla] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [orden, setOrden] = useState("recientes");
  const [bolsa, setBolsa] = useState(() => leer(llaveBolsa, []));
  const [detalle, setDetalle] = useState(null);
  const [visor, setVisor] = useState(null);
  const [bolsaAbierta, setBolsaAbierta] = useState(false);
  const [auth, setAuth] = useState(null); // { modo, motivo }
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [exito, setExito] = useState(null);
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, tone = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "err" ? 6500 : 3800);
  }, []);

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
    supabase.rpc("tienda_config").then(({ data }) => { if (data) setCfg({ destinos: data.destinos?.length ? data.destinos : DEPARTAMENTOS, vigencia_horas: data.vigencia_horas || 48 }); });
    const t = setInterval(cargar, 60000);
    const vis = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", vis);
    // Al volver de iniciar sesión para enviar el pedido, se abre la bolsa otra vez
    try { if (!vistaPrevia && sessionStorage.getItem("vx-abrir-bolsa")) { sessionStorage.removeItem("vx-abrir-bolsa"); setBolsaAbierta(true); } } catch {}
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
            <button onClick={() => setBolsaAbierta(true)} className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-800 hover:bg-slate-100" aria-label={`Mi pedido, ${bolsa.length} pares`}>
              <ShoppingBag size={19} /><span className="hidden sm:inline">Mi pedido</span>
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
        <MisPedidos onVolver={() => setVista("catalogo")} toast={toast} recargarCatalogo={cargar} />
      ) : (
        <>
          <section className="bg-slate-900 text-white relative overflow-hidden">
            <div className="absolute -right-10 -bottom-16 w-72 h-72 opacity-25 pointer-events-none"><Isotipo className="w-full h-full" /></div>
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
              <h1 className="vx-d text-2xl sm:text-5xl font-extrabold leading-tight max-w-2xl">Cada par es único. Cuando lo apartas, es tuyo.</h1>
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-300 max-w-xl">Tenis seleccionados en excelente estado. Recógelos en una paquetería de Cochabamba o te los enviamos a provincias y otros países.</p>
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
                      {p.photos.length > 0 && (
                        <button onClick={() => setVisor(p)} className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-semibold text-slate-800 bg-white rounded-md px-2 py-1 shadow" aria-label={`Ver fotos de ${p.marca} ${p.modelo}`}>
                          <ZoomIn size={13} /> {p.photos.length > 1 ? `${p.photos.length} fotos` : "Foto"}
                        </button>
                      )}
                      {enBolsa(p.id) && <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold bg-purple-700 text-white rounded-md px-2 py-0.5"><Check size={12} /> En tu pedido</span>}
                    </div>
                    <button className="text-left px-3 pt-2.5 flex-1" onClick={() => setDetalle(p.id)}>
                      <div className="text-sm font-semibold text-slate-900 truncate">{p.marca} {p.modelo}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">Talla {String(p.talla).replace(".", ",")}{p.cm ? ` · ${fcm(p.cm)}` : ""} · {p.color}</div>
                      <div className="vx-d vx-num text-lg font-bold text-slate-900 mt-1">{bs0(p.precio)}</div>
                    </button>
                    <div className="p-3 pt-2">
                      <Btn size="sm" variant={enBolsa(p.id) ? "outline" : "primary"} className="w-full" onClick={() => alternar(p)}>
                        {enBolsa(p.id) ? <><Check size={14} /> En tu pedido</> : <><Plus size={14} /> Lo quiero</>}
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
          <span>VORTEX SNEAKERS · Cochabamba, Bolivia</span>
          {!cuenta && !vistaPrevia && <button className="text-left sm:text-right underline" onClick={() => setAuth({ modo: "entrar", motivo: "Si eres parte del equipo, entra con tu correo de trabajo." })}>¿Eres parte del equipo? Ingresa aquí</button>}
        </div>
      </footer>

      {/* Barra inferior en el celular */}
      {bolsa.length > 0 && !bolsaAbierta && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 p-3 vx-safe-b">
          <Btn className="w-full py-3" onClick={() => setBolsaAbierta(true)}><ShoppingBag size={17} /> Ver mi pedido · {bolsa.length} par{bolsa.length === 1 ? "" : "es"} · {bs0((cat || []).filter((p) => bolsa.includes(p.id)).reduce((a, p) => a + p.precio, 0))}</Btn>
        </div>
      )}
      {cuenta && vista === "catalogo" && bolsa.length === 0 && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 p-3 vx-safe-b">
          <Btn variant="outline" className="w-full" onClick={() => setVista("pedidos")}>Mis pedidos</Btn>
        </div>
      )}

      {pDetalle && <DetallePar p={pDetalle} enBolsa={enBolsa(pDetalle.id)} onAlternar={() => alternar(pDetalle)} onFotos={(i) => setVisor({ ...pDetalle, start: i })} onClose={() => setDetalle(null)} />}
      {visor && <PhotoViewer urls={visor.photos.map((f) => f.url)} start={visor.start || 0} title={`${visor.marca} ${visor.modelo}`} onClose={() => setVisor(null)} />}
      {bolsaAbierta && (
        <Bolsa
          pares={(cat || []).filter((p) => bolsa.includes(p.id))} cfg={cfg} cuenta={cuenta}
          onQuitar={(id) => setBolsa(bolsa.filter((x) => x !== id))}
          onClose={() => setBolsaAbierta(false)}
          onNecesitaCuenta={() => { if (vistaPrevia) { toast("Vista de cliente: aquí el cliente crearía su cuenta y enviaría el pedido. No se envió nada."); return; } try { sessionStorage.setItem("vx-abrir-bolsa", "1"); } catch {} setBolsaAbierta(false); setAuth({ modo: "crear", motivo: "Para enviar tu pedido, crea tu cuenta o ingresa. Tus pares siguen guardados." }); }}
          onEnviado={(pedido, info) => { setBolsa([]); setBolsaAbierta(false); setExito({ pedido, ...info }); cargar(); }}
          onError={async (msg) => { toast(msg, "err"); await cargar(); }}
        />
      )}
      {auth && <Acceso modo={auth.modo} motivo={auth.motivo} onClose={() => { setAuth(null); try { sessionStorage.removeItem("vx-abrir-bolsa"); } catch {} }} />}
      {cuentaAbierta && cuenta && <MiCuenta cuenta={cuenta} onClose={() => setCuentaAbierta(false)} onSalir={salir} onGuardado={(c) => { onCuentaCambio(c); toast("Datos guardados."); }} onPedidos={() => { setCuentaAbierta(false); setVista("pedidos"); }} />}
      {exito && (
        <Modal title="¡Pedido recibido!" onClose={() => setExito(null)} footer={<><Btn variant="ghost" onClick={() => setExito(null)}>Seguir viendo</Btn><Btn onClick={() => { setExito(null); setVista("pedidos"); }}><QrCode size={15} /> Pagar ahora</Btn></>}>
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <CheckCircle2 size={44} className="text-cyan-600" />
            <p className="text-base font-semibold text-slate-900">Tu pedido {exito.pedido} está apartado por {cfg.vigencia_horas} horas.</p>
            <ol className="text-sm text-slate-600 text-left space-y-1.5 list-decimal pl-5">
              <li>Entra a <b>Mis pedidos</b> y paga con el QR.</li>
              <li>Sube la foto de tu comprobante.</li>
              <li>Verificamos el pago y te mostramos la fecha en que {exito.modo === "cochabamba" ? "lo dejamos en la paquetería" : "lo enviamos"}.</li>
            </ol>
          </div>
        </Modal>
      )}

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

function DetallePar({ p, enBolsa, onAlternar, onFotos, onClose }) {
  const [i, setI] = useState(0);
  return (
    <Modal wide title={`${p.marca} ${p.modelo}`} onClose={onClose} footer={<><Btn variant="ghost" onClick={onClose}>Cerrar</Btn><Btn variant={enBolsa ? "outline" : "primary"} onClick={onAlternar}>{enBolsa ? <><Trash2 size={15} /> Quitar de mi pedido</> : <><Plus size={15} /> Lo quiero</>}</Btn></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="relative aspect-square rounded-xl overflow-hidden vx-photo">
            <ProductPhoto p={p} idx={i} fit="contain" />
            {p.photos[i] && <button className="absolute inset-0 cursor-zoom-in" onClick={() => onFotos(i)} aria-label="Ver la foto en pantalla completa" />}
            {p.photos[i] && <span className="absolute top-2 right-2 pointer-events-none flex items-center gap-1 text-xs font-semibold bg-white text-slate-800 rounded-md px-2 py-1 shadow"><ZoomIn size={13} /> Ampliar</span>}
          </div>
          {p.photos.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto vx-noscroll">
              {p.photos.map((f, n) => (
                <button key={f.id} onClick={() => setI(n)} className={`w-16 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${n === i ? "border-purple-700" : "border-transparent"}`} aria-label={`Foto ${n + 1}`}>
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
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
            <div className="flex gap-2"><Truck size={14} className="shrink-0 text-slate-400" /> Envío a provincias y a otros países</div>
            <div className="flex gap-2"><QrCode size={14} className="shrink-0 text-slate-400" /> Pagas con QR y subes tu comprobante</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Bolsa({ pares, cfg, cuenta, onQuitar, onClose, onNecesitaCuenta, onEnviado, onError }) {
  const [modo, setModo] = useState("cochabamba");
  const [destino, setDestino] = useState("");
  const [otroDestino, setOtroDestino] = useState("");
  const [transportista, setTransportista] = useState("");
  const [recibe, setRecibe] = useState(cuenta?.nombre || "");
  const [nota, setNota] = useState("");
  const [busy, run] = useBusy();
  const total = pares.reduce((a, p) => a + p.precio, 0);
  const destinoFinal = destino === "__otro" ? otroDestino.trim() : destino;
  const falta = !pares.length ? "Agrega al menos un par." : modo === "envio" && !destinoFinal ? "Elige o escribe a dónde se envía." : "";
  const enviar = () => run(async () => {
    if (!cuenta) { onNecesitaCuenta(); return; }
    const { data, error } = await supabase.rpc("cliente_pedir", {
      p_productos: pares.map((p) => p.id), p_tipo: "Compra",
      p_envio: { modo, destino: modo === "envio" ? destinoFinal : "Cochabamba", transportista, recibe },
      p_nota: nota,
    });
    if (error) { onError(mensajeError(error)); return; }
    onEnviado(data, { n: pares.length, modo });
  });
  return (
    <Modal wide title="Mi pedido" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Seguir viendo</Btn>
      <Btn disabled={busy || !!falta} onClick={enviar}>{busy ? <Spinner /> : <ShoppingBag size={15} />} {cuenta ? "Comprar" : "Continuar"}</Btn>
    </>}>
      {!pares.length ? (
        <div className="py-8 text-center text-sm text-slate-500">Tu pedido está vacío. Toca <b>Lo quiero</b> en los pares que te gusten.</div>
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
          {modo === "envio" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="¿A dónde lo enviamos?">
                <Select value={destino} onChange={(e) => setDestino(e.target.value)} options={[{ value: "", label: "Elige el lugar" }, ...cfg.destinos.filter((d) => d !== "Cochabamba").map((d) => ({ value: d, label: d })), { value: "__otro", label: "Otra provincia o país" }]} />
              </Field>
              {destino === "__otro" && <Field label="Escribe el lugar"><Input value={otroDestino} maxLength={80} placeholder="Ej.: Punata, o Lima (Perú)" onChange={(e) => setOtroDestino(e.target.value)} /></Field>}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Quién recoge (nombre y carnet)"><Input value={recibe} maxLength={120} placeholder="Ej.: Ana Pérez, CI 1234567" onChange={(e) => setRecibe(e.target.value)} /></Field>
            <Field label="Paquetería que prefieres (opcional)"><Input value={transportista} maxLength={80} placeholder="Ej.: la de tu preferencia" onChange={(e) => setTransportista(e.target.value)} /></Field>
          </div>
          <Field label="Nota para nosotros (opcional)"><Input value={nota} maxLength={300} placeholder="Algo que debamos saber" onChange={(e) => setNota(e.target.value)} /></Field>
          <div className="rounded-xl bg-purple-50 p-3 text-xs text-purple-900 flex gap-2"><QrCode size={16} className="shrink-0 text-purple-700" /><span>Al comprar, te apartamos {pares.length === 1 ? "el par" : "los pares"} por {cfg.vigencia_horas} horas. En <b>Mis pedidos</b> pagas con el QR y subes la foto de tu comprobante. Cuando verifiquemos el pago, te avisamos la fecha de envío.{modo === "envio" ? " El costo de la encomienda lo pagas al recoger." : ""}</span></div>
          {!cuenta && <div className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-900 flex gap-2"><User size={16} className="shrink-0 mt-0.5" /> Para comprar necesitas una cuenta. Te pediremos tu nombre, teléfono y correo; tus pares siguen guardados.</div>}
          {falta && pares.length > 0 && <p className="text-xs text-amber-700">{falta}</p>}
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
  const activas = items.filter((x) => x.estado === "Activa");
  const conVenta = items.find((x) => x.venta && x.venta.estado === "Activa");
  const v = conVenta?.venta || null;
  const comp = items.find((x) => x.comprobante)?.comprobante || null;
  const cancelado = !activas.length && !v;
  return { activas, v, comp, cancelado, envio: items[0].envio || {}, vence: activas[0]?.vence };
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

function SubirComprobante({ pedido, total, toast, onListo }) {
  const [file, setFile] = useState(null);
  const [vista, setVista] = useState("");
  const [monto, setMonto] = useState(total ? String(total) : "");
  const [busy, run] = useBusy();
  useEffect(() => { if (!file || !/^image\//.test(file.type)) { setVista(""); return; } const u = URL.createObjectURL(file); setVista(u); return () => URL.revokeObjectURL(u); }, [file]);
  const elegir = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setFile(f); };
  const enviar = () => run(async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) { toast("Vuelve a iniciar sesión e inténtalo otra vez.", "err"); return; }
    const esImagen = /^image\/(jpeg|png|webp)$/.test(file.type);
    const blob: any = esImagen && file.size > 1.5 * 1024 * 1024 ? await comprimirImagen(file, 1800, 0.85) : file;
    if (blob.size > 8 * 1024 * 1024) { toast("El archivo es muy pesado (máximo 8 MB). Sube una captura de pantalla.", "err"); return; }
    const ext = blob !== file ? "jpg" : (String(file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const ruta = `${uid}/${pedido}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from(BUCKET_COMPROBANTES).upload(ruta, blob, { contentType: blob.type || file.type || "image/jpeg", upsert: false });
    if (up.error) { toast("No se pudo subir el comprobante. Revisa tu conexión e inténtalo otra vez.", "err"); return; }
    const { error } = await supabase.rpc("cliente_subir_comprobante", { p_pedido: pedido, p_ruta: ruta, p_monto: monto === "" ? null : Number(monto) });
    if (error) { await supabase.storage.from(BUCKET_COMPROBANTES).remove([ruta]); toast(mensajeError(error), "err"); return; }
    toast("¡Listo! Recibimos tu comprobante. Te avisamos cuando verifiquemos el pago.");
    setFile(null);
    onListo();
  });
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
      <div className="text-sm font-semibold text-slate-900">Sube tu comprobante de pago</div>
      <div className="flex gap-3 items-center">
        <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center overflow-hidden shrink-0">
          {vista ? <img src={vista} alt="Comprobante elegido" className="w-full h-full object-cover" /> : file ? <FileText size={24} className="text-slate-400" /> : <Upload size={22} className="text-slate-300" />}
        </div>
        <div className="flex-1 flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"><Camera size={15} /> Tomar foto<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={elegir} /></label>
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"><Upload size={15} /> Elegir captura o PDF<input type="file" accept="image/*,application/pdf" className="sr-only" onChange={elegir} /></label>
        </div>
      </div>
      {file && <div className="text-xs text-slate-500 truncate">{file.name}</div>}
      <div className="flex items-end gap-2">
        <div className="flex-1"><Field label="Monto que pagaste (Bs)"><Input type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field></div>
        <Btn disabled={busy || !file} onClick={enviar}>{busy ? <Spinner /> : <Upload size={15} />} Enviar</Btn>
      </div>
    </div>
  );
}

function MisPedidos({ onVolver, toast, recargarCatalogo }) {
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
    if (!confirm(`¿Cancelar ${x.par.marca} ${x.par.modelo}? El par vuelve al catálogo y otra persona podrá pedirlo.`)) return;
    const { error } = await supabase.rpc("cliente_cancelar", { p_reserva: x.reserva });
    if (error) { toast(mensajeError(error), "err"); return; }
    toast("Listo, cancelamos ese par.");
    await cargar(); recargarCatalogo();
  });
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
            const { v, comp, activas } = est;
            const saldo = v ? Math.max(0, Number(v.total) - Number(v.pagado)) : 0;
            const porPagar = activas.reduce((a, x) => a + Number(x.par.precio || 0), 0);
            const enRevision = comp?.estado === "En revisión" && activas.length > 0;
            return (
              <section key={k} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div><div className="text-sm font-semibold text-slate-900">Pedido {k}</div><div className="text-xs text-slate-500">{fdate(items[0].creado)}</div></div>
                  <div className="text-xs text-slate-600 flex items-center gap-1"><MapPin size={12} />{textoEntrega(est.envio)}</div>
                </div>
                {est.cancelado ? (
                  <div className="px-4 py-2.5 text-sm text-slate-600 bg-slate-50 flex items-center gap-2"><Pill tone="Cancelada">Cancelado</Pill>{items[0].obs && <span className="text-xs">{items[0].obs}</span>}</div>
                ) : <Seguimiento est={est} />}
                {v && (v.fecha_envio || v.guia) && (
                  <div className="mx-4 mb-3 rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-900 flex flex-wrap gap-x-4 gap-y-0.5">
                    {v.fecha_envio && <span><Truck size={13} className="inline -mt-0.5 mr-1" />{est.envio.modo === "cochabamba" ? "Lo dejamos en la paquetería el" : "Fecha de envío:"} <b>{fdate(v.fecha_envio)}</b></span>}
                    {v.guia && <span>N.º de guía: <b>{v.guia}</b></span>}
                  </div>
                )}
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {items.map((x) => (
                    <div key={x.reserva} className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden vx-photo shrink-0">
                        <ProductPhoto p={{ codigo: x.par.codigo, marca: x.par.marca, modelo: x.par.modelo, hex: colorHex(x.par.color), photos: x.par.foto ? [{ id: x.par.foto, url: fotoUrl(x.par.foto) }] : [] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${x.estado === "Cancelada" ? "text-slate-400 line-through" : ""}`}>{x.par.marca} {x.par.modelo}</div>
                        <div className="text-xs text-slate-500">Talla {String(x.par.talla).replace(".", ",")}{x.par.cm ? ` · ${fcm(x.par.cm)}` : ""} · {bs0(x.par.precio)}</div>
                      </div>
                      {x.estado === "Activa" && !enRevision && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => cancelar(x)}>Cancelar</Btn>}
                    </div>))}
                </div>
                {v && v.estado !== "Anulada" && (
                  <div className="px-4 py-3 bg-slate-50 text-sm vx-num flex flex-wrap gap-x-6 gap-y-1">
                    <span>Total <b>{bs0(v.total)}</b></span><span>Pagado <b className="text-cyan-700">{bs0(v.pagado)}</b></span>{saldo > 0 && <span>Falta pagar <b className="text-rose-600">{bs0(saldo)}</b></span>}
                  </div>
                )}
                {activas.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 space-y-3">
                    {enRevision ? (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900 flex gap-2"><Clock size={16} className="shrink-0 mt-0.5" /><span><b>Comprobante en revisión.</b> Estamos verificando tu pago{comp.monto ? ` de ${bs0(comp.monto)}` : ""}. Tus pares siguen apartados.</span></div>
                    ) : (
                      <>
                        {comp?.estado === "Rechazado" && <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-800 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span><b>No pudimos aprobar tu comprobante:</b> {comp.motivo}. Sube otro, por favor.</span></div>}
                        <p className="text-xs text-slate-600 flex items-center gap-1"><Clock size={12} /> Paga y sube tu comprobante antes del {ftime(est.vence)}, o los pares vuelven al catálogo.</p>
                        <PagosQr items={activas} onAbrir={setQrAbierto} />
                        <SubirComprobante pedido={k} total={porPagar} toast={toast} onListo={cargar} />
                      </>
                    )}
                  </div>
                )}
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
      {qr.monto ? (
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
