import { useState, useEffect, useRef } from "react";
import { Camera, ImagePlus, X, ChevronLeft, ChevronRight, RefreshCw, Check, ZoomIn } from "lucide-react";

const esMovil = () => {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
};

/**
 * Dos botones: "Tomar foto" y "Galería".
 * En el celular, "Tomar foto" abre la cámara del teléfono.
 * En la computadora, abre la cámara web dentro de la app.
 */
export function PhotoPicker({ onFiles, disabled = false, compact = false, max = 8 }) {
  const camRef = useRef(null);
  const galRef = useRef(null);
  const [webcam, setWebcam] = useState(false);
  const recibir = (e) => {
    const fs = Array.from(e.target.files || []) as File[];
    e.target.value = "";
    if (fs.length) onFiles(fs.slice(0, max));
  };
  const tomar = () => (esMovil() ? camRef.current?.click() : setWebcam(true));
  const base = compact
    ? "h-12 px-3 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 hover:border-cyan-500 flex items-center gap-1.5 shrink-0"
    : "flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2";
  return (
    <>
      <button type="button" disabled={disabled} onClick={tomar} className={`${base} disabled:opacity-40`}><Camera size={compact ? 16 : 17} /> Tomar foto</button>
      <button type="button" disabled={disabled} onClick={() => galRef.current?.click()} className={`${base} disabled:opacity-40`}><ImagePlus size={compact ? 16 : 17} /> Galería</button>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={recibir} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={recibir} />
      {webcam && <CameraModal max={max} onClose={() => setWebcam(false)} onDone={(fs) => { setWebcam(false); if (fs.length) onFiles(fs); }} onFallback={() => { setWebcam(false); galRef.current?.click(); }} />}
    </>
  );
}

/** Cámara dentro de la app (sobre todo para computadora con cámara web) */
export function CameraModal({ onClose, onDone, onFallback, max = 8 }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [frente, setFrente] = useState("environment");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [fotos, setFotos] = useState([]); // { file, url }

  useEffect(() => {
    let vivo = true;
    (async () => {
      setListo(false);
      setError("");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: "NoSoportado" });
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: frente }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
        setListo(true);
      } catch (e) {
        const n = e && e.name;
        setError(n === "NotAllowedError" || n === "SecurityError"
          ? "No hay permiso para usar la cámara. Toca el candado junto a la dirección de la página, permite la cámara y vuelve a intentarlo."
          : n === "NotFoundError" || n === "OverconstrainedError"
            ? "No se encontró una cámara en este equipo."
            : n === "NotReadableError"
              ? "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo otra vez."
              : "Este navegador no permite usar la cámara desde la página.");
      }
    })();
    return () => { vivo = false; };
  }, [frente]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => fotos.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const disparar = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || fotos.length >= max) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      const file = new File([b], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      setFotos((fs) => [...fs, { file, url: URL.createObjectURL(b) }]);
    }, "image/jpeg", 0.92);
  };
  const quitar = (i) => setFotos((fs) => { URL.revokeObjectURL(fs[i].url); return fs.filter((_, j) => j !== i); });

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col" style={{ zIndex: 70 }} role="dialog" aria-label="Tomar foto">
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="font-semibold">Tomar foto</span>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar cámara"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 grid place-items-center px-3">
        {error ? (
          <div className="max-w-sm text-center text-white space-y-4">
            <p className="text-sm">{error}</p>
            <button onClick={onFallback} className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold">Elegir fotos de la galería</button>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted autoPlay className="max-w-full max-h-full rounded-xl bg-black" />
        )}
      </div>
      {fotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 shrink-0">
          {fotos.map((f, i) => (
            <div key={f.url} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 border-white">
              <img src={f.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => quitar(i)} className="absolute top-0 right-0 bg-white rounded-bl p-0.5 text-rose-600" aria-label="Quitar foto"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-4 vx-safe-b shrink-0">
        <button onClick={() => setFrente(frente === "environment" ? "user" : "environment")} disabled={!!error} className="p-3 rounded-full bg-slate-800 text-white disabled:opacity-30" aria-label="Cambiar de cámara"><RefreshCw size={20} /></button>
        <button onClick={disparar} disabled={!listo || fotos.length >= max} className="w-16 h-16 rounded-full bg-white ring-4 ring-slate-500 disabled:opacity-30" aria-label="Sacar foto" />
        <button onClick={() => onDone(fotos.map((f) => f.file))} disabled={!fotos.length} className="px-4 py-3 rounded-full bg-purple-700 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-30">
          <Check size={17} /> Usar {fotos.length || ""}
        </button>
      </div>
    </div>
  );
}

/** Ver las fotos completas en pantalla grande. Desliza o usa las flechas; doble toque para acercar. */
export function PhotoViewer({ urls, start = 0, title = "", onClose }) {
  const [i, setI] = useState(Math.min(start, Math.max(0, urls.length - 1)));
  const [zoom, setZoom] = useState(null); // { x, y } en % cuando está acercada
  const toque = useRef(null);
  const ultimoToque = useRef(0);
  const ir = (d) => { setZoom(null); setI((n) => (n + d + urls.length) % urls.length); };

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && urls.length > 1) ir(1);
      if (e.key === "ArrowLeft" && urls.length > 1) ir(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [urls.length]);

  const alternarZoom = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setZoom(zoom ? null : { x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 });
  };
  const abajo = (ev) => { toque.current = { x: ev.clientX, y: ev.clientY }; };
  const arriba = (ev) => {
    const t = toque.current;
    toque.current = null;
    if (!t) return;
    const dx = ev.clientX - t.x, dy = ev.clientY - t.y;
    if (!zoom && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && urls.length > 1) { ir(dx < 0 ? 1 : -1); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const ahora = Date.now();
      if (ahora - ultimoToque.current < 300) { alternarZoom(ev); ultimoToque.current = 0; }
      else ultimoToque.current = ahora;
    }
  };

  if (!urls.length) return null;
  return (
    <div className="fixed inset-0 bg-black flex flex-col select-none" style={{ zIndex: 70 }} role="dialog" aria-label={title ? `Fotos de ${title}` : "Fotos"} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="text-sm font-semibold truncate">{title}{urls.length > 1 ? `  ·  ${i + 1} de ${urls.length}` : ""}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(zoom ? null : { x: 50, y: 50 })} className={`p-2 rounded-lg ${zoom ? "bg-white text-slate-900" : "hover:bg-slate-800"}`} aria-label={zoom ? "Alejar" : "Acercar"} aria-pressed={!!zoom}><ZoomIn size={19} /></button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar"><X size={22} /></button>
        </div>
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden" style={{ touchAction: zoom ? "auto" : "pan-y" }} onPointerDown={abajo} onPointerUp={arriba}>
        <img src={urls[i]} alt={title ? `${title}, foto ${i + 1}` : `Foto ${i + 1}`} draggable={false}
          className="absolute inset-0 w-full h-full object-contain transition-transform duration-200"
          style={zoom ? { transform: "scale(2.2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
        {urls.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); ir(-1); }} onPointerUp={(e) => e.stopPropagation()} className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white text-slate-900 shadow" aria-label="Foto anterior"><ChevronLeft size={22} /></button>
            <button onClick={(e) => { e.stopPropagation(); ir(1); }} onPointerUp={(e) => e.stopPropagation()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white text-slate-900 shadow" aria-label="Foto siguiente"><ChevronRight size={22} /></button>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3 vx-safe-b shrink-0">
          {urls.map((u, n) => (
            <button key={u + n} onClick={() => { setZoom(null); setI(n); }} className={`w-14 h-11 rounded-md overflow-hidden shrink-0 border-2 ${n === i ? "border-white" : "border-transparent opacity-60"}`} aria-label={`Ver foto ${n + 1}`}>
              <img src={u} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {urls.length < 2 && <p className="text-center text-xs text-slate-400 py-3 vx-safe-b">Toca dos veces para acercar</p>}
    </div>
  );
}
