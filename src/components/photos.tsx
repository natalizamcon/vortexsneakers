import { useAtras } from "../lib/atras";
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
  useAtras(true, onClose);
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
  useAtras(true, onClose);
  const [i, setI] = useState(Math.min(start, Math.max(0, urls.length - 1)));
  const [acercada, setAcercada] = useState(false);
  const zonaRef = useRef(null);
  const imgRef = useRef(null);
  // Estado del zoom en una referencia: se mueve la imagen directo, sin redibujar la pantalla en cada movimiento
  const z = useRef({ s: 1, x: 0, y: 0 });
  const dedos = useRef(new Map());
  const gesto = useRef(null);
  const ultimoToque = useRef({ t: 0, x: 0, y: 0 });
  const cuadro = useRef(0);

  const aplicar = (animar = false) => {
    const el = imgRef.current;
    if (!el) return;
    cancelAnimationFrame(cuadro.current);
    cuadro.current = requestAnimationFrame(() => {
      el.style.transition = animar ? "transform 180ms ease-out" : "none";
      el.style.transform = `translate3d(${z.current.x}px, ${z.current.y}px, 0) scale(${z.current.s})`;
    });
  };
  // Que la foto no se salga de la pantalla al moverla
  const limitar = () => {
    const zona = zonaRef.current, img = imgRef.current;
    if (!zona || !img) return;
    const W = zona.clientWidth, H = zona.clientHeight;
    const nw = img.naturalWidth || W, nh = img.naturalHeight || H;
    const base = Math.min(W / nw, H / nh);
    const w = nw * base * z.current.s, h = nh * base * z.current.s;
    const mx = Math.max(0, (w - W) / 2), my = Math.max(0, (h - H) / 2);
    z.current.x = Math.min(mx, Math.max(-mx, z.current.x));
    z.current.y = Math.min(my, Math.max(-my, z.current.y));
  };
  const zoomEn = (nuevo, cx, cy, animar = false) => {
    const zona = zonaRef.current;
    if (!zona) return;
    const r = zona.getBoundingClientRect();
    const px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
    const s0 = z.current.s;
    const s = Math.min(5, Math.max(1, nuevo));
    // El punto bajo los dedos queda en el mismo lugar
    z.current.x = px - ((px - z.current.x) * s) / s0;
    z.current.y = py - ((py - z.current.y) * s) / s0;
    z.current.s = s;
    if (s === 1) { z.current.x = 0; z.current.y = 0; }
    limitar(); aplicar(animar);
    const a = s > 1.01;
    setAcercada((v) => (v === a ? v : a));
  };
  const reiniciar = (animar = false) => { z.current = { s: 1, x: 0, y: 0 }; aplicar(animar); setAcercada(false); };
  const ir = (d) => { reiniciar(); setI((n) => (n + d + urls.length) % urls.length); };

  useEffect(() => {
    const k = (e) => {
      if (e.key === "ArrowRight" && urls.length > 1) ir(1);
      if (e.key === "ArrowLeft" && urls.length > 1) ir(-1);
    };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); cancelAnimationFrame(cuadro.current); };
  }, [urls.length]);
  useEffect(() => {
    const zona = zonaRef.current;
    if (!zona) return;
    const rueda = (e) => { e.preventDefault(); zoomEn(z.current.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); };
    zona.addEventListener("wheel", rueda, { passive: false });
    return () => zona.removeEventListener("wheel", rueda);
  }, []);

  const abajo = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...dedos.current.values()];
    if (ps.length === 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
      gesto.current = { tipo: "pellizco", d, s: z.current.s };
    } else if (ps.length === 1) {
      gesto.current = { tipo: "uno", x0: e.clientX, y0: e.clientY, px: z.current.x, py: z.current.y, t: Date.now(), movio: false };
    }
  };
  const mover = (e) => {
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    const ps = [...dedos.current.values()];
    if (g.tipo === "pellizco" && ps.length >= 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
      zoomEn(g.s * (d / g.d), (ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2);
    } else if (g.tipo === "uno") {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.movio = true;
      if (z.current.s > 1.01) { z.current.x = g.px + dx; z.current.y = g.py + dy; limitar(); aplicar(); }
      else if (urls.length > 1) { const el = imgRef.current; if (el) { el.style.transition = "none"; el.style.transform = `translate3d(${dx}px,0,0)`; } }
    }
  };
  const arriba = (e) => {
    dedos.current.delete(e.pointerId);
    const g = gesto.current;
    if (g?.tipo === "pellizco") {
      if (dedos.current.size === 0) { gesto.current = null; if (z.current.s < 1.05) reiniciar(true); }
      else { const [p] = [...dedos.current.values()]; gesto.current = { tipo: "uno", x0: p.x, y0: p.y, px: z.current.x, py: z.current.y, t: Date.now(), movio: true }; }
      return;
    }
    gesto.current = null;
    if (!g) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (z.current.s <= 1.01 && urls.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { ir(dx < 0 ? 1 : -1); return; }
    if (z.current.s <= 1.01) aplicar(true);
    if (!g.movio) {
      const ahora = Date.now(), u = ultimoToque.current;
      if (ahora - u.t < 320 && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 40) {
        ultimoToque.current = { t: 0, x: 0, y: 0 };
        if (z.current.s > 1.01) reiniciar(true); else zoomEn(2.5, e.clientX, e.clientY, true);
      } else ultimoToque.current = { t: ahora, x: e.clientX, y: e.clientY };
    }
  };
  const cancelar = (e) => { dedos.current.delete(e.pointerId); gesto.current = null; };

  if (!urls.length) return null;
  return (
    <div className="fixed inset-0 bg-black flex flex-col select-none" style={{ zIndex: 70 }} role="dialog" aria-label={title ? `Fotos de ${title}` : "Fotos"} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="text-sm font-semibold truncate">{title}{urls.length > 1 ? `  ·  ${i + 1} de ${urls.length}` : ""}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => { const r = zonaRef.current?.getBoundingClientRect(); if (acercada) reiniciar(true); else if (r) zoomEn(2.5, r.left + r.width / 2, r.top + r.height / 2, true); }} className={`p-2 rounded-lg ${acercada ? "bg-white text-slate-900" : "hover:bg-slate-800"}`} aria-label={acercada ? "Alejar" : "Acercar"} aria-pressed={acercada}><ZoomIn size={19} /></button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar"><X size={22} /></button>
        </div>
      </div>
      <div ref={zonaRef} className="relative flex-1 min-h-0 overflow-hidden" style={{ touchAction: "none" }}
        onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={cancelar}>
        <img ref={imgRef} key={urls[i]} src={urls[i]} alt={title ? `${title}, foto ${i + 1}` : `Foto ${i + 1}`} draggable={false} decoding="async"
          className="absolute inset-0 w-full h-full object-contain will-change-transform" style={{ transformOrigin: "50% 50%" }} />
        {urls.length > 1 && !acercada && (
          <>
            <button onClick={(e) => { e.stopPropagation(); ir(-1); }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white text-slate-900 shadow" aria-label="Foto anterior"><ChevronLeft size={22} /></button>
            <button onClick={(e) => { e.stopPropagation(); ir(1); }} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white text-slate-900 shadow" aria-label="Foto siguiente"><ChevronRight size={22} /></button>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3 vx-safe-b shrink-0">
          {urls.map((u, n) => (
            <button key={u + n} onClick={() => { reiniciar(); setI(n); }} className={`w-14 h-11 rounded-md overflow-hidden shrink-0 border-2 ${n === i ? "border-white" : "border-transparent opacity-60"}`} aria-label={`Ver foto ${n + 1}`}>
              <img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-slate-400 pb-3 vx-safe-b">{acercada ? "Arrastra para mover · toca dos veces para alejar" : "Pellizca o toca dos veces para acercar"}</p>
    </div>
  );
}
