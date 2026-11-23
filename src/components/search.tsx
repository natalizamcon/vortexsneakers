import { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { norm } from "../lib/utils";
import { inputCls } from "./ui";

/**
 * Buscador con lista de resultados debajo (no flotante, para que funcione bien en el celular
 * y dentro de las ventanas). Busca por todas las palabras escritas, sin importar tildes.
 */
export function SearchBox({
  items, getText, render, onPick, placeholder = "Buscar…", sinResultados = "No se encontró nada.",
  inicial = null, footer = null, max = 8, autoFocus = false, label = "Buscar",
}: {
  items: any[]; getText: (x: any) => string; render: (x: any) => any; onPick: (x: any) => void;
  placeholder?: string; sinResultados?: string; inicial?: any[] | null; footer?: ((q: string) => any) | null;
  max?: number; autoFocus?: boolean; label?: string;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(autoFocus);
  const [activo, setActivo] = useState(0);
  const ref = useRef(null);
  const palabras = norm(q).split(/\s+/).filter(Boolean);
  const resultados = palabras.length
    ? items.filter((x) => { const t = norm(getText(x)); return palabras.every((w) => t.includes(w)); }).slice(0, max)
    : (inicial || items).slice(0, max);
  const elegir = (x) => { onPick(x); setQ(""); setActivo(0); setAbierto(false); ref.current?.blur(); };
  const tecla = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { if (abierto && resultados[activo]) { e.preventDefault(); elegir(resultados[activo]); } }
    else if (e.key === "Escape") { setAbierto(false); }
  };
  return (
    <div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
        <input ref={ref} className={inputCls + " pl-9 pr-9"} value={q} placeholder={placeholder} autoFocus={autoFocus} aria-label={label}
          role="combobox" aria-expanded={abierto} aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); setActivo(0); setAbierto(true); }}
          onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} onKeyDown={tecla} />
        {q && <button type="button" className="absolute right-2 top-1.5 p-1 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Borrar búsqueda" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(""); ref.current?.focus(); }}><X size={15} /></button>}
      </div>
      {abierto && (
        <div className="mt-1 rounded-xl border border-slate-200 bg-white overflow-hidden" role="listbox">
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {resultados.map((x, i) => (
              <button key={x.id || i} type="button" role="option" aria-selected={i === activo}
                onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActivo(i)} onClick={() => elegir(x)}
                className={`w-full text-left px-3 py-2 ${i === activo ? "bg-purple-50" : "hover:bg-slate-50"}`}>
                {render(x)}
              </button>
            ))}
            {!resultados.length && <p className="px-3 py-3 text-sm text-slate-500">{sinResultados}</p>}
          </div>
          {footer && <div className="border-t border-slate-100" onMouseDown={(e) => e.preventDefault()}>{footer(q)}</div>}
        </div>
      )}
    </div>
  );
}
