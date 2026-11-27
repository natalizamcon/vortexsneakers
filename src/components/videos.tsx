// Videos de los pares: grabar dentro de la app, subir desde la galería,
// reducir el tamaño automáticamente y reproducir en pantalla completa.
import { useState, useEffect, useRef } from "react";
import { useAtras } from "../lib/atras";
import { Video, Film, X, RefreshCw, Check, Play, Square, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { useBloquearScroll } from "../lib/bloqueo";

export const MAX_MB = 48;              // Supabase gratis acepta hasta 50 MB por archivo
export const MAX_SEGUNDOS_GRABAR = 60;
const MAX_SEGUNDOS_VIDEO = 180;

const esMovil = () => {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
};

/** Formato de video que este navegador puede grabar (preferimos MP4: se ve en todos los teléfonos) */
export function formatoGrabacion() {
  const MR: any = typeof window !== "undefined" ? (window as any).MediaRecorder : null;
  if (!MR) return null;
  const tipos = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return tipos.find((t) => { try { return MR.isTypeSupported(t); } catch { return false; } }) || "";
}
const extDe = (tipo) => (/mp4/.test(tipo) ? "mp4" : /quicktime|mov/.test(tipo) ? "mov" : /webm/.test(tipo) ? "webm" : "mp4");
export const fduracion = (s) => { if (!s && s !== 0) return ""; const n = Math.round(Number(s)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`; };

function abrirVideo(blob): Promise<HTMLVideoElement> {
  return new Promise((ok, mal) => {
    const v = document.createElement("video");
    v.preload = "auto"; v.muted = true; v.playsInline = true;
    v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
    const url = URL.createObjectURL(blob);
    const t = setTimeout(() => mal(new Error("tiempo")), 15000);
    v.onloadedmetadata = () => { clearTimeout(t); ok(v); };
    v.onerror = () => { clearTimeout(t); URL.revokeObjectURL(url); mal(new Error("formato")); };
    v.src = url;
  });
}
const soltar = (v) => { try { URL.revokeObjectURL(v.src); v.removeAttribute("src"); v.load(); } catch {} };

/** Duración y una imagen de portada (un cuadro del inicio del video) */
export async function datosDeVideo(blob): Promise<{ duracion: number | null; portada: Blob | null }> {
  let v;
  try { v = await abrirVideo(blob); } catch { return { duracion: null, portada: null }; }
  let duracion = isFinite(v.duration) ? v.duration : null;
  let portada = null;
  try {
    await new Promise((ok) => {
      const t = setTimeout(ok, 6000);
      v.onseeked = () => { clearTimeout(t); ok(null); };
      v.currentTime = Math.min(0.6, (duracion || 1) / 3);
    });
    if (v.videoWidth) {
      const esc = Math.min(1, 900 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(v.videoWidth * esc); c.height = Math.round(v.videoHeight * esc);
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      portada = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    }
  } catch {}
  soltar(v);
  return { duracion, portada };
}

/**
 * Si el video pesa más de lo permitido, lo vuelve a grabar más liviano (720p) dentro del navegador.
 * Tarda lo mismo que dura el video. El video reducido queda sin sonido.
 */
export async function reducirVideo(file, onProgreso = (_p: number) => {}): Promise<Blob> {
  const tipo = formatoGrabacion();
  if (tipo === null || typeof (HTMLCanvasElement.prototype as any).captureStream !== "function") throw new Error(`El video pesa más de ${MAX_MB} MB y este navegador no puede reducirlo. Graba uno más corto o usa "Grabar video".`);
  const v = await abrirVideo(file);
  if (v.duration > MAX_SEGUNDOS_VIDEO) { soltar(v); throw new Error(`El video dura más de ${MAX_SEGUNDOS_VIDEO / 60} minutos. Recórtalo en tu celular y vuelve a subirlo.`); }
  const esc = Math.min(1, 1280 / Math.max(v.videoWidth || 1280, v.videoHeight || 720));
  const c = document.createElement("canvas");
  c.width = Math.round((v.videoWidth || 1280) * esc / 2) * 2; c.height = Math.round((v.videoHeight || 720) * esc / 2) * 2;
  const ctx = c.getContext("2d");
  const stream = (c as any).captureStream(30);
  const rec = new (window as any).MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 2_200_000 });
  const partes = [];
  rec.ondataavailable = (e) => e.data && e.data.size && partes.push(e.data);
  const fin = new Promise<void>((ok) => { rec.onstop = () => ok(); });
  rec.start(1000);
  let corriendo = true;
  const dibujar = () => {
    if (!corriendo) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    onProgreso(v.duration ? Math.min(1, v.currentTime / v.duration) : 0);
    requestAnimationFrame(dibujar);
  };
  await v.play();
  dibujar();
  await new Promise((ok) => { v.onended = ok; });
  corriendo = false;
  rec.stop();
  await fin;
  stream.getTracks().forEach((t) => t.stop());
  soltar(v);
  return new Blob(partes, { type: (rec.mimeType || tipo || "video/webm").split(";")[0] });
}

/** Deja el video listo para subir: revisa el tamaño (y lo reduce si hace falta) y saca la portada */
export async function prepararVideo(file, onEstado = (_t: string) => {}) {
  let blob = file;
  if (file.size > MAX_MB * 1024 * 1024) {
    onEstado("Reduciendo el tamaño del video… 0%");
    blob = await reducirVideo(file, (p) => onEstado(`Reduciendo el tamaño del video… ${Math.round(p * 100)}%`));
    if (blob.size > MAX_MB * 1024 * 1024) throw new Error("El video sigue siendo muy pesado. Graba uno más corto (menos de 1 minuto).");
  }
  onEstado("Preparando la vista previa…");
  const { duracion, portada } = await datosDeVideo(blob);
  if (duracion && duracion > MAX_SEGUNDOS_VIDEO) throw new Error(`El video dura más de ${MAX_SEGUNDOS_VIDEO / 60} minutos. Recórtalo y vuelve a subirlo.`);
  const tipo = (blob.type || file.type || "video/mp4").split(";")[0];
  return { blob, tipo, ext: extDe(tipo), duracion, portada };
}

/**
 * Dos botones: "Grabar video" y "Subir video".
 * Grabar abre la cámara dentro de la app (videos livianos, hasta 1 minuto).
 */
export function VideoPicker({ onFiles, disabled = false, compact = false }) {
  const galRef = useRef(null);
  const camRef = useRef(null);
  const [grabar, setGrabar] = useState(false);
  const recibir = (e) => {
    const fs = Array.from(e.target.files || []) as File[];
    e.target.value = "";
    if (fs.length) onFiles(fs.slice(0, 3));
  };
  const abrirGrabadora = () => (formatoGrabacion() !== null && navigator.mediaDevices?.getUserMedia ? setGrabar(true) : camRef.current?.click());
  const base = compact
    ? "h-12 px-3 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 hover:border-cyan-500 flex items-center gap-1.5 shrink-0"
    : "flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2";
  return (
    <>
      <button type="button" disabled={disabled} onClick={abrirGrabadora} className={`${base} disabled:opacity-40`}><Video size={compact ? 16 : 17} /> Grabar video</button>
      <button type="button" disabled={disabled} onClick={() => galRef.current?.click()} className={`${base} disabled:opacity-40`}><Film size={compact ? 16 : 17} /> Subir video</button>
      <input ref={camRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={recibir} />
      <input ref={galRef} type="file" accept="video/*" multiple className="hidden" onChange={recibir} />
      {grabar && <VideoRecorderModal onClose={() => setGrabar(false)} onDone={(f) => { setGrabar(false); if (f) onFiles([f]); }} onFallback={() => { setGrabar(false); (esMovil() ? camRef : galRef).current?.click(); }} />}
    </>
  );
}

/** Grabadora de video dentro de la app */
export function VideoRecorderModal({ onClose, onDone, onFallback }) {
  useBloquearScroll(true);
  useAtras(true, () => { try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch {} onClose(); });
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const partesRef = useRef([]);
  const [frente, setFrente] = useState("environment");
  const [sonido, setSonido] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [resultado, setResultado] = useState(null); // { file, url }

  useEffect(() => {
    if (resultado) return;
    let vivo = true;
    (async () => {
      setListo(false); setError("");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: "NoSoportado" });
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: frente }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: sonido });
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
        setListo(true);
      } catch (e) {
        const n = e && e.name;
        setError(n === "NotAllowedError" || n === "SecurityError"
          ? `No hay permiso para usar la cámara${sonido ? " o el micrófono" : ""}. Toca el candado junto a la dirección de la página, permítelo y vuelve a intentarlo.`
          : n === "NotFoundError" || n === "OverconstrainedError" ? "No se encontró una cámara en este equipo."
            : n === "NotReadableError" ? "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo otra vez."
              : "Este navegador no permite grabar desde la página.");
      }
    })();
    return () => { vivo = false; };
  }, [frente, sonido, resultado]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (resultado) URL.revokeObjectURL(resultado.url); }, [resultado]);
  useEffect(() => {
    if (!grabando) return;
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [grabando]);
  useEffect(() => { if (grabando && seg >= MAX_SEGUNDOS_GRABAR) detener(); }, [seg, grabando]);

  const empezar = () => {
    const tipo = formatoGrabacion();
    const s = streamRef.current;
    if (!s) return;
    try {
      const rec = new (window as any).MediaRecorder(s, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 2_500_000 });
      partesRef.current = [];
      rec.ondataavailable = (e) => e.data && e.data.size && partesRef.current.push(e.data);
      rec.onstop = () => {
        const mime = (rec.mimeType || tipo || "video/webm").split(";")[0];
        const blob = new Blob(partesRef.current, { type: mime });
        const file = new File([blob], `video-${Date.now()}.${extDe(mime)}`, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setResultado({ file, url: URL.createObjectURL(blob) });
      };
      rec.start(1000);
      recRef.current = rec;
      setSeg(0); setGrabando(true);
    } catch { setError("Este navegador no permite grabar video desde la página."); }
  };
  const detener = () => { setGrabando(false); try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch {} };

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col" style={{ zIndex: 70 }} role="dialog" aria-label="Grabar video">
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="font-semibold flex items-center gap-2">{grabando ? <><span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" /> Grabando {fduracion(seg)} / {fduracion(MAX_SEGUNDOS_GRABAR)}</> : resultado ? "Revisa tu video" : "Grabar video"}</span>
        <button onClick={() => { detener(); onClose(); }} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 grid place-items-center px-3">
        {error ? (
          <div className="max-w-sm text-center text-white space-y-4">
            <p className="text-sm">{error}</p>
            <button onClick={onFallback} className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold">{esMovil() ? "Grabar con la cámara del celular" : "Elegir un video guardado"}</button>
          </div>
        ) : resultado ? (
          <video src={resultado.url} controls playsInline autoPlay className="max-w-full max-h-full rounded-xl bg-black" />
        ) : (
          <video ref={videoRef} playsInline muted autoPlay className="max-w-full max-h-full rounded-xl bg-black" />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-4 vx-safe-b shrink-0">
        {resultado ? (
          <>
            <button onClick={() => { setResultado(null); setSeg(0); }} className="px-4 py-3 rounded-full bg-slate-800 text-white text-sm font-semibold flex items-center gap-1.5"><RotateCcw size={17} /> Repetir</button>
            <button onClick={() => onDone(resultado.file)} className="px-5 py-3 rounded-full bg-purple-700 text-white text-sm font-semibold flex items-center gap-1.5"><Check size={17} /> Usar video</button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <button onClick={() => setFrente(frente === "environment" ? "user" : "environment")} disabled={!!error || grabando} className="p-3 rounded-full bg-slate-800 text-white disabled:opacity-30" aria-label="Cambiar de cámara"><RefreshCw size={20} /></button>
              <button onClick={() => setSonido(!sonido)} disabled={!!error || grabando} className="p-3 rounded-full bg-slate-800 text-white disabled:opacity-30" aria-label={sonido ? "Grabar sin sonido" : "Grabar con sonido"} title={sonido ? "Con sonido" : "Sin sonido"}>{sonido ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
            </div>
            <button onClick={grabando ? detener : empezar} disabled={!listo} className="w-16 h-16 rounded-full bg-white ring-4 ring-slate-500 grid place-items-center disabled:opacity-30" aria-label={grabando ? "Detener" : "Empezar a grabar"}>
              {grabando ? <Square size={22} className="text-rose-600 fill-rose-600" /> : <span className="w-11 h-11 rounded-full bg-rose-600" />}
            </button>
            <span className="w-24 text-right text-xs text-slate-400">Máx. 1 min</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Miniatura de un video (portada con botón de reproducir) */
export function VideoThumb({ v, onClick, className = "", children = null }) {
  return (
    <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
      {v.portadaUrl ? <img src={v.portadaUrl} alt="" className="w-full h-full object-cover opacity-90" /> : v.localUrl ? <video src={v.localUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-500"><Film size={22} /></div>}
      <button type="button" onClick={onClick} className="absolute inset-0 grid place-items-center" aria-label="Ver video">
        <span className="w-9 h-9 rounded-full bg-white/90 grid place-items-center shadow"><Play size={16} className="text-slate-900 fill-slate-900 ml-0.5" /></span>
      </button>
      {v.duracion ? <span className="absolute bottom-1 right-1 pointer-events-none text-[10px] font-semibold text-white bg-black/60 rounded px-1">{fduracion(v.duracion)}</span> : null}
      {children}
    </div>
  );
}

/** Reproducir un video en pantalla completa */
export function VideoPlayer({ url, title = "", onClose }) {
  useBloquearScroll(true);
  useAtras(true, onClose);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col" style={{ zIndex: 75 }} role="dialog" aria-label={title || "Video"}>
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="font-semibold truncate">{title}</span>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Cerrar video"><X size={22} /></button>
      </div>
      <div className="flex-1 min-h-0 grid place-items-center px-2 pb-4">
        <video src={url} controls autoPlay playsInline className="max-w-full max-h-full rounded-lg bg-black" />
      </div>
    </div>
  );
}
