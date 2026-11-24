// Tienda en línea de VORTEX SNEAKERS: catálogo público, cuenta de cliente y pedidos.
// Aquí NUNCA se leen tablas internas: todo llega de funciones que solo devuelven datos de compra.
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag, Search, X, ZoomIn, Check, Plus, Trash2, Store, Truck, Package, Clock, LogOut, User,
  CheckCircle2, AlertTriangle, ChevronRight, MapPin, RefreshCw,
} from "lucide-react";
import { supabase, fotoUrl, mensajeError } from "../lib/supabase";
import { bs0, fcm, colorHex, norm, ftime, fdate, DEPARTAMENTOS } from "../lib/utils";
import { Logo, Isotipo, Btn, Field, Input, Select, inputCls, Modal, PasswordInput, ProductPhoto, Spinner, Pill, useBusy } from "../components/ui";
import { PhotoViewer } from "../components/photos";

const BOLSA_KEY = "vx-bolsa";
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const ENTREGAS = [
  { k: "Recojo en punto", titulo: "Recoger en tienda", desc: "Pasas por el par en Cochabamba.", icon: Store },
  { k: "Delivery Cochabamba", titulo: "Envío a domicilio", desc: "Te lo llevamos dentro de Cochabamba.", icon: Truck },
  { k: "Encomienda", titulo: "Recoger en paquetería", desc: "Lo enviamos por encomienda a tu ciudad y lo recoges ahí.", icon: Package },
];
const ZONAS = ["Cercado", "Sacaba", "Quillacollo", "Tiquipaya", "Colcapirhua", "Vinto", "Sipe Sipe", ...DEPARTAMENTOS];

/** Convierte un par del catálogo público al formato que usan las fotos de la app */
const aPar = (x) => ({
  ...x, precio: Number(x.precio) || 0, talla: Number(x.talla), cm: x.cm == null ? null : Number(x.cm),
  estadoFisico: x.estado_fisico, hex: colorHex(x.color),
  photos: (x.fotos || []).map((ruta) => ({ id: ruta, url: fotoUrl(ruta) })),
});

export function Tienda({ cuenta, onCuentaCambio }) {
  const [cat, setCat] = useState(null);
  const [error, setError] = useState("");
  const [cfg, setCfg] = useState({ destinos: DEPARTAMENTOS, vigencia_horas: 48 });
  const [vista, setVista] = useState("catalogo");
  const [q, setQ] = useState("");
  const [talla, setTalla] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [orden, setOrden] = useState("recientes");
  const [bolsa, setBolsa] = useState(() => leer(BOLSA_KEY, []));
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
    try { if (sessionStorage.getItem("vx-abrir-bolsa")) { sessionStorage.removeItem("vx-abrir-bolsa"); setBolsaAbierta(true); } } catch {}
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [cargar]);
  useEffect(() => guardar(BOLSA_KEY, bolsa), [bolsa]);

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
              <Btn size="sm" onClick={() => setAuth({ modo: "entrar" })}>Ingresar</Btn>
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
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-300 max-w-xl">Tenis seleccionados en excelente estado. Recoge en Cochabamba o recíbelos en cualquier ciudad de Bolivia.</p>
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
          {!cuenta && <button className="text-left sm:text-right underline" onClick={() => setAuth({ modo: "entrar", motivo: "Si eres parte del equipo, entra con tu correo de trabajo." })}>¿Eres parte del equipo? Ingresa aquí</button>}
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
          onNecesitaCuenta={() => { try { sessionStorage.setItem("vx-abrir-bolsa", "1"); } catch {} setBolsaAbierta(false); setAuth({ modo: "crear", motivo: "Para enviar tu pedido, crea tu cuenta o ingresa. Tus pares siguen guardados." }); }}
          onEnviado={(pedido, info) => { setBolsa([]); setBolsaAbierta(false); setExito({ pedido, ...info }); cargar(); }}
          onError={async (msg) => { toast(msg, "err"); await cargar(); }}
        />
      )}
      {auth && <Acceso modo={auth.modo} motivo={auth.motivo} onClose={() => { setAuth(null); try { sessionStorage.removeItem("vx-abrir-bolsa"); } catch {} }} />}
      {cuentaAbierta && cuenta && <MiCuenta cuenta={cuenta} onClose={() => setCuentaAbierta(false)} onSalir={salir} onGuardado={(c) => { onCuentaCambio(c); toast("Datos guardados."); }} onPedidos={() => { setCuentaAbierta(false); setVista("pedidos"); }} />}
      {exito && (
        <Modal title="¡Pedido enviado!" onClose={() => setExito(null)} footer={<><Btn variant="ghost" onClick={() => setExito(null)}>Seguir viendo</Btn><Btn onClick={() => { setExito(null); setVista("pedidos"); }}>Ver mis pedidos</Btn></>}>
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <CheckCircle2 size={44} className="text-cyan-600" />
            <p className="text-base font-semibold text-slate-900">Tu pedido {exito.pedido} está apartado.</p>
            <p className="text-sm text-slate-600">Guardamos {exito.n === 1 ? "tu par" : `tus ${exito.n} pares`} por {cfg.vigencia_horas} horas. Te escribiremos por WhatsApp al <b>{cuenta?.telefono}</b> para confirmar el pago y {exito.entrega === "Recojo en punto" ? "coordinar el recojo" : "el envío"}.</p>
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
            <div className="flex gap-2"><Store size={14} className="shrink-0 text-slate-400" /> Recógelo en Cochabamba</div>
            <div className="flex gap-2"><Truck size={14} className="shrink-0 text-slate-400" /> Envío a domicilio en Cochabamba</div>
            <div className="flex gap-2"><Package size={14} className="shrink-0 text-slate-400" /> Encomienda a cualquier ciudad de Bolivia</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Bolsa({ pares, cfg, cuenta, onQuitar, onClose, onNecesitaCuenta, onEnviado, onError }) {
  const [tipo, setTipo] = useState("Compra");
  const [entrega, setEntrega] = useState("Recojo en punto");
  const [direccion, setDireccion] = useState(cuenta?.direccion || "");
  const [destino, setDestino] = useState("");
  const [otroDestino, setOtroDestino] = useState("");
  const [transportista, setTransportista] = useState("");
  const [nota, setNota] = useState("");
  const [busy, run] = useBusy();
  const total = pares.reduce((a, p) => a + p.precio, 0);
  const destinoFinal = destino === "__otro" ? otroDestino.trim() : destino;
  const falta = !pares.length ? "Agrega al menos un par." : entrega === "Delivery Cochabamba" && !direccion.trim() ? "Escribe la dirección de entrega." : entrega === "Encomienda" && !destinoFinal ? "Elige la ciudad a la que se envía." : "";
  const enviar = () => run(async () => {
    if (!cuenta) { onNecesitaCuenta(); return; }
    const { data, error } = await supabase.rpc("cliente_pedir", {
      p_productos: pares.map((p) => p.id), p_tipo: tipo,
      p_envio: { entrega, direccion: entrega === "Delivery Cochabamba" ? direccion : "", destino: entrega === "Encomienda" ? destinoFinal : "", transportista: entrega === "Encomienda" ? transportista : "" },
      p_nota: nota,
    });
    if (error) { onError(mensajeError(error)); return; }
    onEnviado(data, { n: pares.length, entrega });
  });
  return (
    <Modal wide title="Mi pedido" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Seguir viendo</Btn>
      <Btn disabled={busy || !!falta} onClick={enviar}>{busy ? <Spinner /> : <ShoppingBag size={15} />} {cuenta ? (tipo === "Reserva" ? "Reservar" : "Enviar pedido") : "Continuar"}</Btn>
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
            <div className="text-xs font-semibold text-slate-700 mb-1.5">¿Qué quieres hacer?</div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de pedido">
              {[["Compra", "Comprar", "Te confirmamos el pago y te lo entregamos."], ["Reserva", `Reservar ${cfg.vigencia_horas} h`, "Lo apartamos mientras decides."]].map(([k, t, d]) => (
                <button key={k} type="button" role="radio" aria-checked={tipo === k} onClick={() => setTipo(k)} className={`text-left rounded-xl border p-3 ${tipo === k ? "border-purple-700 ring-1 ring-purple-700 bg-purple-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <span className="block text-sm font-semibold text-slate-900">{t}</span><span className="block text-xs text-slate-500 mt-0.5">{d}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5">¿Cómo lo recibes?</div>
            <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Entrega">
              {ENTREGAS.map(({ k, titulo, desc, icon: I }) => (
                <button key={k} type="button" role="radio" aria-checked={entrega === k} onClick={() => setEntrega(k)} className={`text-left rounded-xl border p-3 ${entrega === k ? "border-purple-700 ring-1 ring-purple-700 bg-purple-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <I size={18} className={entrega === k ? "text-purple-700" : "text-slate-400"} />
                  <span className="block text-sm font-semibold text-slate-900 mt-1">{titulo}</span><span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          {entrega === "Delivery Cochabamba" && <Field label="Dirección de entrega en Cochabamba"><Input value={direccion} placeholder="Zona, calle, número y una referencia" onChange={(e) => setDireccion(e.target.value)} /></Field>}
          {entrega === "Encomienda" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Ciudad o lugar de destino">
                <Select value={destino} onChange={(e) => setDestino(e.target.value)} options={[{ value: "", label: "Elige tu ciudad" }, ...cfg.destinos.map((d) => ({ value: d, label: d })), { value: "__otro", label: "Otra ciudad o pueblo" }]} />
              </Field>
              {destino === "__otro" ? <Field label="¿Cuál?"><Input value={otroDestino} placeholder="Ej.: Montero" onChange={(e) => setOtroDestino(e.target.value)} /></Field>
                : <Field label="Empresa de encomienda que prefieres (opcional)"><Input value={transportista} placeholder="Ej.: la flota de tu preferencia" onChange={(e) => setTransportista(e.target.value)} /></Field>}
            </div>
          )}
          <Field label="Nota para nosotros (opcional)"><Input value={nota} maxLength={300} placeholder="Ej.: horario para recoger o algo que debamos saber" onChange={(e) => setNota(e.target.value)} /></Field>
          <p className="text-xs text-slate-500">{entrega === "Recojo en punto" ? "Te pasaremos la dirección y el horario por WhatsApp." : "El costo del envío lo coordinamos contigo por WhatsApp."} Tus pares quedan apartados para ti hasta que confirmemos el pago.</p>
          {!cuenta && <div className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-900 flex gap-2"><User size={16} className="shrink-0 mt-0.5" /> Para enviar tu pedido necesitas una cuenta. Te pediremos tu nombre, teléfono y correo; tus pares siguen guardados.</div>}
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
            <Field label="Dirección (opcional)" hint="Solo si quieres que te lo llevemos a domicilio."><Input value={f.direccion} autoComplete="street-address" onChange={set("direccion")} /></Field>
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

const estadoItem = (x) => {
  if (x.estado === "Activa") return { tone: "Reservado", texto: "Apartado · por confirmar" };
  if (x.estado === "Cancelada") return { tone: "Cancelada", texto: "Cancelado" };
  if (!x.venta || x.venta.estado === "Anulada") return { tone: "Anulada", texto: "Anulado" };
  if (x.venta.entrega === "Entregado") return { tone: "Pagado", texto: "Entregado" };
  return { tone: "Disponible", texto: `Confirmado · ${String(x.venta.entrega).toLowerCase()}` };
};
const textoEntrega = (e) => !e?.entrega ? "" : e.entrega === "Recojo en punto" ? "Recoges en tienda (Cochabamba)" : e.entrega === "Delivery Cochabamba" ? `Envío a: ${e.direccion}` : `Encomienda a ${e.destino}${e.transportista ? ` por ${e.transportista}` : ""}`;

function MisPedidos({ onVolver, toast, recargarCatalogo }) {
  const [lista, setLista] = useState(null);
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
            const v = items.find((x) => x.venta)?.venta;
            const saldo = v ? Math.max(0, Number(v.total) - Number(v.pagado)) : 0;
            return (
              <section key={k} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div><div className="text-sm font-semibold text-slate-900">Pedido {k}</div><div className="text-xs text-slate-500">{fdate(items[0].creado)} · {items[0].tipo === "Reserva" ? "Reserva" : "Compra"}</div></div>
                  <div className="text-xs text-slate-600 flex items-center gap-1"><MapPin size={12} />{textoEntrega(items[0].envio)}</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map((x) => { const st = estadoItem(x); return (
                    <div key={x.reserva} className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 rounded-lg overflow-hidden vx-photo shrink-0">
                        <ProductPhoto p={{ codigo: x.par.codigo, marca: x.par.marca, modelo: x.par.modelo, hex: colorHex(x.par.color), photos: x.par.foto ? [{ id: x.par.foto, url: fotoUrl(x.par.foto) }] : [] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{x.par.marca} {x.par.modelo}</div>
                        <div className="text-xs text-slate-500">Talla {String(x.par.talla).replace(".", ",")}{x.par.cm ? ` · ${fcm(x.par.cm)}` : ""} · {bs0(x.par.precio)}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5"><Pill tone={st.tone}>{st.texto}</Pill>
                          {x.estado === "Activa" && <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={11} /> hasta {ftime(x.vence)}</span>}
                          {x.estado === "Cancelada" && x.obs && <span className="text-xs text-slate-500">{x.obs}</span>}
                        </div>
                      </div>
                      {x.estado === "Activa" && <Btn size="sm" variant="ghost" disabled={busy} onClick={() => cancelar(x)}>Cancelar</Btn>}
                    </div>); })}
                </div>
                {v && v.estado !== "Anulada" && (
                  <div className="px-4 py-3 bg-slate-50 text-sm vx-num flex flex-wrap gap-x-6 gap-y-1">
                    <span>Total <b>{bs0(v.total)}</b></span><span>Pagado <b className="text-cyan-700">{bs0(v.pagado)}</b></span>{saldo > 0 && <span>Falta pagar <b className="text-rose-600">{bs0(saldo)}</b></span>}
                  </div>
                )}
                {items.some((x) => x.estado === "Activa") && <p className="px-4 py-2.5 text-xs text-slate-500 border-t border-slate-100">Te escribiremos por WhatsApp para confirmar el pago y la entrega.</p>}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
