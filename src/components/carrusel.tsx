// Fotos que se deslizan con el dedo (y con flechas en la computadora), con puntitos abajo.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Carrusel({ fotos, alt = "", fit = "cover", indice = null, onIndice = null, onTap = null, vacio = null, className = "" }) {
  const ref = useRef(null);
  const [actual, setActual] = useState(0);
  const n = fotos.length;

  // Ir a una foto cuando la eligen desde afuera (miniaturas)
  useEffect(() => {
    const el = ref.current;
    if (indice == null || !el || indice === actual) return;
    el.scrollTo({ left: indice * el.clientWidth, behavior: "smooth" });
  }, [indice]);

  const alMover = () => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== actual) { setActual(i); onIndice && onIndice(i); }
  };
  const ir = (d, e) => {
    e.stopPropagation();
    const el = ref.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(n - 1, actual + d)) * el.clientWidth, behavior: "smooth" });
  };

  if (!n) return vacio;
  return (
    <div className={`relative w-full h-full group ${className}`}>
      <div ref={ref} onScroll={alMover} className="w-full h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory vx-noscroll" style={{ overscrollBehaviorX: "contain", WebkitOverflowScrolling: "touch" }}>
        {fotos.map((f, i) => (
          <button key={f.id || f.url} type="button" onClick={() => onTap && onTap(i)} className="w-full h-full shrink-0 snap-center snap-always" aria-label={n > 1 ? `${alt}, foto ${i + 1} de ${n}` : alt}>
            <img src={f.url} alt="" draggable={false} loading={i === 0 ? "eager" : "lazy"} decoding="async" className={`w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"} pointer-events-none select-none`} />
          </button>
        ))}
      </div>
      {n > 1 && (
        <>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none" aria-hidden="true">
            {fotos.slice(0, 8).map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === actual ? "w-4 bg-white" : "w-1.5 bg-white/60"} shadow`} />)}
          </div>
          {actual > 0 && <button type="button" onClick={(e) => ir(-1, e)} className="hidden sm:grid absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow place-items-center opacity-0 group-hover:opacity-100 transition" aria-label="Foto anterior"><ChevronLeft size={18} /></button>}
          {actual < n - 1 && <button type="button" onClick={(e) => ir(1, e)} className="hidden sm:grid absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow place-items-center opacity-0 group-hover:opacity-100 transition" aria-label="Foto siguiente"><ChevronRight size={18} /></button>}
        </>
      )}
    </div>
  );
}
