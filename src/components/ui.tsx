import { useState } from "react";
import { X, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { C } from "../lib/utils";

/* Isotipo VORTEX: V turquesa-morado, órbita y píxeles */
let gid = 0;
export function Isotipo({ className = "", mono }) {
  const [id] = useState(() => "vx" + ++gid);
  const f = (k) => (mono ? "currentColor" : `url(#${id}${k})`);
  return (
    <svg viewBox="0 -16 124 116" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id + "a"} x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#08BFC5" /><stop offset="0.55" stopColor="#1f7fe0" /><stop offset="1" stopColor="#5a2fd8" /></linearGradient>
        <linearGradient id={id + "b"} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B76AF2" /><stop offset="1" stopColor="#7928CA" /></linearGradient>
        <linearGradient id={id + "c"} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#08BFC5" /><stop offset="1" stopColor="#B76AF2" /></linearGradient>
      </defs>
      <path d="M62 66 L86 12 Q87.5 9 91 9 L110 9 L67 92 Z" fill={f("b")} />
      <path d="M4 9 L30 9 Q34 9 36 12.5 L72 70 L58 98 Z" fill={f("a")} />
      <path d="M24 49 C3 61 9 81 49 79 C85 77 116 60 112 44 C111 40 106 38 101 38" fill="none" stroke={f("c")} strokeWidth="4" strokeLinecap="round" />
      <rect x="94" y="-6" width="9" height="9" rx="1" fill={mono ? "currentColor" : "#B76AF2"} />
      <rect x="106" y="-15" width="10" height="10" rx="1" fill={mono ? "currentColor" : "#B76AF2"} />
      <rect x="107" y="1" width="6" height="6" rx="1" fill={mono ? "currentColor" : "#7928CA"} />
    </svg>
  );
}
export function Logo({ dark = false, size = "md" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      <Isotipo className={big ? "w-14 h-14" : "w-10 h-10"} />
      <div className="leading-none">
        <div className={`relative inline-block font-extrabold ${dark ? "text-white" : "text-slate-900"} ${big ? "text-3xl" : "text-xl"}`}>
          VORTEX<span className="absolute -right-2 top-0 w-2.5 h-2 -skew-x-12" style={{ background: C.teal }} />
        </div>
        <div className={`font-semibold mt-1 ${big ? "text-sm" : "text-xs"} ${dark ? "text-cyan-300" : "text-slate-500"}`} style={{ letterSpacing: "0.42em" }}>SNEAKERS</div>
      </div>
    </div>
  );
}
export function Sneaker({ hex, className = "" }) {
  const dark = ["#1f2937", "#1e3a8a", "#15803d", "#dc2626"].includes(hex);
  const accent = dark ? "#e2e8f0" : C.lilaD;
  return (
    <svg viewBox="0 0 120 70" className={className} aria-hidden="true">
      <ellipse cx="60" cy="64" rx="50" ry="4" fill="#0f172a" opacity="0.08" />
      <path d="M8 50 C8 41 14 35 25 34 L44 31 C50 22 56 15 65 15 L73 17 C75 25 81 31 93 34 C105 37 112 41 112 48 L112 52 L8 52 Z" fill={hex} stroke="#0f172a" strokeOpacity="0.18" />
      <path d="M6 52 L114 52 Q116 60 108 60 L12 60 Q4 60 6 52 Z" fill="#ffffff" stroke="#0f172a" strokeOpacity="0.2" />
      <path d="M50 31 L57 37 M56 26 L63 32 M62 21 L69 27" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 45 L96 45" stroke={accent} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}
export function Btn({ children, variant = "primary", size = "md", className = "", ...p }) {
  const v = {
    primary: "bg-purple-700 text-white hover:bg-purple-800",
    lila: "bg-cyan-500 text-slate-900 hover:bg-cyan-600",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    outline: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
    danger: "bg-white text-rose-600 border border-rose-200 hover:bg-rose-50",
  }[variant];
  const s = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  return <button className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v} ${s} ${className}`} {...p}>{children}</button>;
}
export const PILL = {
  Disponible: "bg-cyan-50 text-cyan-700 ring-cyan-200", Reservado: "bg-purple-50 text-purple-700 ring-purple-200", Vendido: "bg-slate-100 text-slate-600 ring-slate-200", Eliminado: "bg-rose-50 text-rose-700 ring-rose-200",
  Pagado: "bg-cyan-50 text-cyan-700 ring-cyan-200", Parcial: "bg-amber-50 text-amber-700 ring-amber-200", Pendiente: "bg-rose-50 text-rose-700 ring-rose-200",
  Reembolsado: "bg-slate-100 text-slate-600 ring-slate-200", Anulada: "bg-slate-100 text-slate-500 ring-slate-200", Activa: "bg-purple-50 text-purple-700 ring-purple-200",
  Cancelada: "bg-slate-100 text-slate-500 ring-slate-200", Convertida: "bg-cyan-50 text-cyan-700 ring-cyan-200", Americano: "bg-sky-50 text-sky-700 ring-sky-200", Coreano: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
};
export const Pill = ({ children, tone }) => <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${PILL[tone || children] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>{children}</span>;
export const Panel = ({ title, action, children, className = "", sub }) => (
  <section className={`bg-white rounded-xl border border-slate-200 ${className}`}>
    {(title || action) && (
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
        <div><h3 className="font-semibold text-slate-900 text-sm">{title}</h3>{sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}</div>
        {action}
      </div>
    )}
    <div className="p-4">{children}</div>
  </section>
);
export const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
  </label>
);
export const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100";
export const Input = (p) => <input className={inputCls} {...p} />;
export const Select = ({ options, ...p }) => <select className={inputCls} {...p}>{options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900 bg-opacity-40 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-white w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col`} style={{ maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sm:hidden flex justify-center pt-2"><span className="w-10 h-1 rounded-full bg-slate-300" /></div>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100">
          <h2 className="vx-d font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="vx-safe-b px-4 sm:px-5 py-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
export function Stat({ label, value, sub, tone = "slate", icon: Icon }) {
  const bar = { teal: "bg-cyan-500", lila: "bg-purple-500", slate: "bg-slate-300", rose: "bg-rose-400", amber: "bg-amber-400" }[tone];
  return (
    <div className="relative bg-white rounded-xl border border-slate-200 px-3 sm:px-4 py-3 sm:py-3.5 overflow-hidden min-w-0">
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${bar}`} />
      <div className="flex items-center justify-between text-xs text-slate-500">{label}{Icon && <Icon size={15} className="text-slate-400" />}</div>
      <div className="vx-d vx-num text-base sm:text-xl font-semibold text-slate-900 mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
export const PageHead = ({ title, route, desc, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
    <div>
      <h1 className="vx-d text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
      {desc && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{desc}</p>}
    </div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);
export const MRow = ({ children, onClick }) => onClick
  ? <button onClick={onClick} className="w-full text-left px-4 py-3 active:bg-slate-50">{children}</button>
  : <div className="px-4 py-3">{children}</div>;
export const Table = ({ head, children, empty, mobile }) => (
  <>
  {mobile && <div className="sm:hidden -mx-4 -my-4 divide-y divide-slate-100">{mobile}{empty && <p className="text-center text-sm text-slate-400 py-8">{empty}</p>}</div>}
  <div className={`overflow-x-auto ${mobile ? "hidden sm:block" : ""}`}>
    <table className="w-full text-sm">
      <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200">{head.map((h, i) => <th key={i} className="py-2 px-3 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
    {empty && <p className="text-center text-sm text-slate-400 py-8">{empty}</p>}
  </div>
  </>
);
export const Td = ({ children, className = "" }) => <td className={`py-2.5 px-3 whitespace-nowrap ${className}`}>{children}</td>;
export const Note = ({ children, tone = "lila" }) => (
  <div className={`flex gap-2 rounded-lg px-3 py-2 text-xs ${tone === "lila" ? "bg-purple-50 text-purple-800" : tone === "rose" ? "bg-rose-50 text-rose-800" : "bg-cyan-50 text-cyan-800"}`}>
    <Lock size={14} className="shrink-0 mt-0.5" /><span>{children}</span>
  </div>
);


/** Foto real del par (si tiene) o la ilustración de reemplazo */
export function ProductPhoto({ p, className = "", idx = 0 }) {
  const f = p.photos && p.photos[idx];
  if (f) return <img src={f.url} alt={`${p.codigo} ${p.marca} ${p.modelo}`} loading="lazy" className={`w-full h-full object-cover ${className}`} />;
  return <div className={`w-full h-full grid place-items-center ${className}`}><Sneaker hex={p.hex} className="w-4/5" /></div>;
}

/** Evita doble clic mientras se guarda algo */
export function useBusy(): [boolean, (fn: () => Promise<any>) => Promise<void>] {
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { if (busy) return; setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return [busy, run];
}

export const Spinner = ({ size = 16, className = "" }) => <Loader2 size={size} className={`vx-spin ${className}`} />;

/** Campo de contraseña con botón para ver lo que se escribe */
export function PasswordInput({ value, onChange, placeholder = "", autoComplete = "current-password", id = undefined }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} className={inputCls + " pr-10"} type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:bg-slate-100" aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
  );
}
