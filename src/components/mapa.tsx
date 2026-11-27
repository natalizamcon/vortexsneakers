// Paqueterías: mapa dentro de la app y botón para abrir en Google Maps / Mapas.
import { MapPin, Navigation } from "lucide-react";

export const PAQUETERIA_INICIAL = { id: "market-b", nombre: "MARKET B", direccion: "Av. Heroínas, Cochabamba", mapa: "", lat: null, lng: null, activa: true };

/** Saca la latitud y longitud de un enlace de Google Maps (o de un texto "lat, lng") */
export function coordsDeEnlace(t) {
  const s = String(t || "");
  const pats = [/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|ll|query|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const re of pats) {
    const m = s.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

const tieneCoords = (p) => p && p.lat != null && p.lng != null && p.lat !== "" && p.lng !== "" && isFinite(Number(p.lat)) && isFinite(Number(p.lng));
/** Lo que se busca en el mapa: las coordenadas, o el nombre y la dirección */
export function lugarDe(p) {
  if (tieneCoords(p)) return `${Number(p.lat)},${Number(p.lng)}`;
  const dir = [p?.nombre, p?.direccion].filter(Boolean).join(", ");
  return /cochabamba/i.test(dir) ? `${dir}, Bolivia` : `${dir}, Cochabamba, Bolivia`;
}
export const urlAbrirMapa = (p) => (/^https?:\/\//i.test(String(p?.mapa || "")) ? p.mapa : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lugarDe(p))}`);
export const urlMapaEmbebido = (p) => `https://maps.google.com/maps?q=${encodeURIComponent(lugarDe(p))}&z=16&output=embed`;

/** Tarjeta de una paquetería: nombre, dirección, mapa y botón "Abrir en Maps" */
export function MapaPaqueteria({ p, alto = 180, mapa = true, className = "" }) {
  if (!p) return null;
  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="px-3 py-2.5 flex items-start gap-2">
        <MapPin size={16} className="text-purple-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-900">{p.nombre || "Paquetería"}</div>
          {p.direccion && <div className="text-xs text-slate-600">{p.direccion}</div>}
        </div>
        <a href={urlAbrirMapa(p)} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold px-2.5 py-1.5"><Navigation size={13} /> Abrir en Maps</a>
      </div>
      {mapa && (
        <iframe title={`Mapa de ${p.nombre || "la paquetería"}`} src={urlMapaEmbebido(p)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          className="w-full border-0 block bg-slate-100" style={{ height: alto }} />
      )}
    </div>
  );
}
