// Recortar una foto: elegir la forma (cuadrada, vertical, horizontal u original),
// acercar con los dedos o la barra, mover la foto dentro del marco y girarla.
import { useState, useEffect, useRef } from "react";
import { X, Check, RotateCw, Crop } from "lucide-react";
import { useAtras } from "../lib/atras";

export const FORMAS = [
  { k: "1:1", label: "Cuadrada", r: 1 },
  { k: "4:5", label: "Vertical", r: 4 / 5 },
  { k: "4:3", label: "Horizontal", r: 4 / 3 },
  { k: "orig", label: "Original", r: 0 },
];

async function abrirImagen(src): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("imagen"));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/**
 * file: archivo nuevo, o url: foto ya subida.
 * onDone(blob) entrega la foto recortada (JPEG). onSkip: usar la foto tal cual.
 */
export function CropModal({ file = null, url = "", titulo = "Ajustar foto", paso = "", onDone, onSkip = null, onClose }) {
  useAtras(true, onClose);
  const marcoRef = useRef(null);
  const imgRef = useRef(null);
  const [src, setSrc] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [forma, setForma] = useState("1:1");
  const [giro, setGiro] = useState(0);
  const [marco, setMarco] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const pos = useRef({ x: 0, y: 0 });        // posición de la foto dentro del marco
  const zr = useRef(1);
  const dedos = useRef(new Map());
  const gesto = useRef(null);

  // Cargar la foto (girada si hace falta)
  useEffect(() => {
    let vivo = true, temporal = "";
    (async () => {
      try {
        const base = file ? (temporal = URL.createObjectURL(file)) : url;
        const img = await abrirImagen(base);
        let final = base, w = img.naturalWidth, h = img.naturalHeight;
        if (giro) {
          const c = document.createElement("canvas");
          const rot = giro % 180 !== 0;
          c.width = rot ? h : w; c.height = rot ? w : h;
          const ctx = c.getContext("2d");
          ctx.translate(c.width / 2, c.height / 2); ctx.rotate((giro * Math.PI) / 180); ctx.drawImage(img, -w / 2, -h / 2);
          const b: Blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.95));
          final = URL.createObjectURL(b);
          w = c.width; h = c.height;
        }
        if (!vivo) return;
        setSrc((viejo) => { if (viejo && viejo.startsWith("blob:") && viejo !== temporal) URL.revokeObjectURL(viejo); return final; });
        setNat({ w, h });
      } catch { if (vivo) setError("No se pudo abrir esta foto."); }
    })();
    return () => { vivo = false; };
  }, [file, url, giro]);
  useEffect(() => () => { if (src && src.startsWith("blob:")) URL.revokeObjectURL(src); }, []);

  // Tamaño del marco según la forma elegida y el espacio disponible
  const relacion = () => { const f = FORMAS.find((x) => x.k === forma); return f.r || (nat.w && nat.h ? nat.w / nat.h : 1); };
  useEffect(() => {
    const medir = () => {
      const cont = marcoRef.current?.parentElement;
      if (!cont) return;
      const W = cont.clientWidth - 24, H = cont.clientHeight - 24, r = relacion();
      let w = W, h = W / r;
      if (h > H) { h = H; w = H * r; }
      setMarco({ w: Math.max(80, Math.floor(w)), h: Math.max(80, Math.floor(h)) });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [forma, nat.w, nat.h]);

  const escalaBase = () => (nat.w ? Math.max(marco.w / nat.w, marco.h / nat.h) : 1);
  const limitar = () => {
    const s = escalaBase() * zr.current;
    const w = nat.w * s, h = nat.h * s;
    pos.current.x = Math.min(0, Math.max(marco.w - w, pos.current.x));
    pos.current.y = Math.min(0, Math.max(marco.h - h, pos.current.y));
  };
  const pintar = () => {
    const el = imgRef.current;
    if (!el || !nat.w) return;
    const s = escalaBase() * zr.current;
    el.style.width = `${nat.w * s}px`; el.style.height = `${nat.h * s}px`;
    el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
  };
  const centrar = () => {
    zr.current = 1; setZoom(1);
    const s = escalaBase();
    pos.current = { x: (marco.w - nat.w * s) / 2, y: (marco.h - nat.h * s) / 2 };
    pintar();
  };
  useEffect(() => { if (marco.w && nat.w) centrar(); }, [marco.w, marco.h, nat.w, nat.h, src]);

  const zoomA = (nuevo, cx = marco.w / 2, cy = marco.h / 2) => {
    const s0 = escalaBase() * zr.current;
    zr.current = Math.min(4, Math.max(1, nuevo));
    const s = escalaBase() * zr.current;
    pos.current.x = cx - ((cx - pos.current.x) * s) / s0;
    pos.current.y = cy - ((cy - pos.current.y) * s) / s0;
    limitar(); pintar();
  };

  const abajo = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...dedos.current.values()];
    gesto.current = ps.length >= 2
      ? { tipo: "pellizco", d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, z: zr.current }
      : { tipo: "mover", x: e.clientX, y: e.clientY, px: pos.current.x, py: pos.current.y };
  };
  const mover = (e) => {
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current, ps = [...dedos.current.values()];
    if (!g) return;
    if (g.tipo === "pellizco" && ps.length >= 2) {
      const r = marcoRef.current.getBoundingClientRect();
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1;
      zoomA(g.z * (d / g.d), (ps[0].x + ps[1].x) / 2 - r.left, (ps[0].y + ps[1].y) / 2 - r.top);
    } else if (g.tipo === "mover") {
      pos.current.x = g.px + (e.clientX - g.x); pos.current.y = g.py + (e.clientY - g.y);
      limitar(); pintar();
    }
  };
  const arriba = (e) => {
    dedos.current.delete(e.pointerId);
    if (dedos.current.size === 1) { const [p] = [...dedos.current.values()]; gesto.current = { tipo: "mover", x: p.x, y: p.y, px: pos.current.x, py: pos.current.y }; }
    else if (!dedos.current.size) { gesto.current = null; setZoom(zr.current); }
  };
  useEffect(() => {
    const el = marcoRef.current;
    if (!el) return;
    const rueda = (e) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomA(zr.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); setZoom(zr.current); };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  });

  const listo = async () => {
    setTrabajando(true);
    try {
      const img = await abrirImagen(src);
      const s = escalaBase() * zr.current;
      const sx = -pos.current.x / s, sy = -pos.current.y / s, sw = marco.w / s, sh = marco.h / s;
      const largo = Math.min(1600, Math.max(sw, sh));
      const f = largo / Math.max(sw, sh);
      const c = document.createElement("canvas");
      c.width = Math.round(sw * f); c.height = Math.round(sh * f);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const b: Blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
      if (!b) throw new Error();
      onDone(new File([b], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch { setError("No se pudo recortar la foto. Inténtalo otra vez."); }
    setTrabajando(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col select-none" style={{ zIndex: 72 }} role="dialog" aria-label={titulo}>
      <div className="flex items-center justify-between px-4 h-14 text-white shrink-0">
        <span className="font-semibold flex items-center gap-2"><Crop size={17} /> {titulo}{paso ? <span className="text-slate-400 font-normal text-sm"> · {paso}</span> : null}</span>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 grid place-items-center p-3">
        {error ? <p className="text-sm text-white text-center max-w-xs">{error}</p> : (
          <div ref={marcoRef} className="relative overflow-hidden bg-slate-800 rounded-md outline outline-2 outline-white/90" style={{ width: marco.w || 200, height: marco.h || 200, touchAction: "none", cursor: "grab" }}
            onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={arriba}>
            {src && <img ref={imgRef} src={src} alt="Foto a recortar" draggable={false} className="absolute top-0 left-0 max-w-none will-change-transform" style={{ transformOrigin: "0 0" }} />}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({ length: 9 }).map((_, n) => <span key={n} className="border border-white/20" />)}</div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 pb-3 space-y-3 vx-safe-b">
        <div className="flex items-center gap-3 text-white">
          <span className="text-xs text-slate-400 w-12">Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => { setZoom(Number(e.target.value)); zoomA(Number(e.target.value)); }} className="flex-1 accent-cyan-400" aria-label="Acercar o alejar" />
          <button onClick={() => setGiro((g) => (g + 90) % 360)} className="p-2.5 rounded-full bg-slate-800 text-white" aria-label="Girar la foto"><RotateCw size={18} /></button>
        </div>
        <div className="flex gap-1.5 justify-center" role="radiogroup" aria-label="Forma de la foto">
          {FORMAS.map((f) => (
            <button key={f.k} role="radio" aria-checked={forma === f.k} onClick={() => setForma(f.k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${forma === f.k ? "bg-white text-slate-900" : "bg-slate-800 text-slate-200"}`}>{f.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {onSkip && <button onClick={onSkip} className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold">Usar sin recortar</button>}
          <button onClick={listo} disabled={trabajando || !!error || !src} className="flex-1 py-3 rounded-xl bg-purple-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"><Check size={17} /> {trabajando ? "Guardando…" : "Listo"}</button>
        </div>
      </div>
    </div>
  );
}

/** Recorta una lista de fotos una por una. Devuelve las fotos finales con onTerminar. */
export function RecortarVarias({ files, onTerminar, onCancelar }) {
  const [n, setN] = useState(0);
  const listas = useRef([]);
  const siguiente = (f) => {
    listas.current = [...listas.current, f];
    if (n + 1 >= files.length) onTerminar(listas.current);
    else setN(n + 1);
  };
  return (
    <CropModal key={n} file={files[n]} paso={files.length > 1 ? `Foto ${n + 1} de ${files.length}` : ""}
      onDone={siguiente} onSkip={() => siguiente(files[n])}
      onClose={() => (listas.current.length ? onTerminar(listas.current) : onCancelar())} />
  );
}
