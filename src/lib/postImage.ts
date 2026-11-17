// Arma la imagen para redes: la foto de portada con el precio, la talla y los
// centímetros escritos encima, más el logo de VORTEX. Todo ocurre en el
// navegador; no se sube nada a ningún servidor.

export const FORMATOS = {
  cuadrado: { label: "Cuadrado 1:1", hint: "Facebook, Instagram, WhatsApp", w: 1080, h: 1080 },
  vertical: { label: "Vertical 4:5", hint: "Publicación de Instagram", w: 1080, h: 1350 },
  historia: { label: "Historia 9:16", hint: "Estados, historias, TikTok", w: 1080, h: 1920 },
};

const INK = "#10142C";
const TEAL = "#08BFC5";
const VIOLET = "#7928CA";
const LILA = "#B76AF2";

const ISOTIPO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -16 124 116" width="248" height="232">
<defs>
<linearGradient id="a" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#08BFC5"/><stop offset="0.55" stop-color="#1f7fe0"/><stop offset="1" stop-color="#5a2fd8"/></linearGradient>
<linearGradient id="b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B76AF2"/><stop offset="1" stop-color="#7928CA"/></linearGradient>
<linearGradient id="c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#08BFC5"/><stop offset="1" stop-color="#B76AF2"/></linearGradient>
</defs>
<path d="M62 66 L86 12 Q87.5 9 91 9 L110 9 L67 92 Z" fill="url(#b)"/>
<path d="M4 9 L30 9 Q34 9 36 12.5 L72 70 L58 98 Z" fill="url(#a)"/>
<path d="M24 49 C3 61 9 81 49 79 C85 77 116 60 112 44 C111 40 106 38 101 38" fill="none" stroke="url(#c)" stroke-width="4" stroke-linecap="round"/>
<rect x="94" y="-6" width="9" height="9" rx="1" fill="#B76AF2"/>
<rect x="106" y="-15" width="10" height="10" rx="1" fill="#B76AF2"/>
<rect x="107" y="1" width="6" height="6" rx="1" fill="#7928CA"/>
</svg>`;

let isotipoCache: Promise<HTMLImageElement> | null = null;
function cargarIsotipo(): Promise<HTMLImageElement> {
  if (!isotipoCache) {
    isotipoCache = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ISOTIPO_SVG);
    });
  }
  return isotipoCache;
}

/** Carga una foto de Supabase sin "ensuciar" el lienzo (para poder descargarlo) */
export async function cargarFoto(url: string): Promise<any> {
  try {
    const r = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!r.ok) throw new Error("http " + r.status);
    const blob = await r.blob();
    if ((window as any).createImageBitmap) return await (window as any).createImageBitmap(blob);
    const u = URL.createObjectURL(blob);
    return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  } catch {
    return await new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("No se pudo cargar la foto. Revisa tu conexión e inténtalo otra vez."));
      i.src = url + (url.includes("?") ? "&" : "?") + "vx=1";
    });
  }
}

async function fuentesListas() {
  try {
    const f: any = (document as any).fonts;
    if (f && f.load) await Promise.all([f.load("800 120px Montserrat"), f.load("700 40px Montserrat"), f.load("600 40px Montserrat")]);
  } catch {}
}

function rect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Ajusta el tamaño de letra para que el texto entre en el ancho disponible */
function ajustar(ctx, texto, peso, maxPx, minPx, ancho) {
  let px = maxPx;
  while (px > minPx) {
    ctx.font = `${peso} ${px}px Montserrat, system-ui, sans-serif`;
    if (ctx.measureText(texto).width <= ancho) break;
    px -= 2;
  }
  return px;
}

function chip(ctx, x, y, texto, fondo, color, u) {
  ctx.font = `700 ${Math.round(40 * u)}px Montserrat, system-ui, sans-serif`;
  const padX = 26 * u, h = 72 * u;
  const w = ctx.measureText(texto).width + padX * 2;
  ctx.fillStyle = fondo;
  rect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x + padX, y + h / 2 + 2 * u);
  return w;
}

export type OpcionesImagen = {
  formato: keyof typeof FORMATOS;
  precio: string;      // texto ya listo, p. ej. "Bs 180"
  talla: string;       // "42"
  cm: string;          // "27" (vacío = no se muestra)
  titulo: string;      // marca y modelo
  codigo: string;
  extra: string;       // línea opcional: "Envíos a todo Bolivia"
  mostrar: { precio: boolean; talla: boolean; cm: boolean; titulo: boolean; codigo: boolean };
  // Cómo se acomoda la foto: x e y en fracción del lienzo (0 = centrada), zoom 1 = llena el lienzo
  encuadre?: { x: number; y: number; zoom: number };
};

export const ENCUADRE_INICIAL = { x: 0, y: 0, zoom: 1 };

/** Dibuja la imagen completa en el lienzo indicado */
export async function dibujarImagen(canvas: HTMLCanvasElement, foto: any, o: OpcionesImagen) {
  await fuentesListas();
  const { w: W, h: H } = FORMATOS[o.formato] || FORMATOS.cuadrado;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const u = W / 1080;
  const M = 64 * u;                          // margen
  const top = o.formato === "historia" ? 150 * u : 0; // zona libre de la barra de historias

  // 1. Foto: fondo difuminado y encima la foto acomodada por el usuario
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (foto) {
    const fw = foto.width, fh = foto.height;
    const cover = Math.max(W / fw, H / fh);
    const e = o.encuadre || ENCUADRE_INICIAL;
    const zoom = Math.min(3, Math.max(0.5, e.zoom || 1));
    // Fondo: la misma foto llenando todo, difuminada y oscurecida (se ve si la foto no cubre el lienzo)
    if (zoom < 1 || e.x || e.y) {
      const bw = fw * cover * 1.1, bh = fh * cover * 1.1;
      try { (ctx as any).filter = `blur(${Math.round(36 * u)}px)`; } catch {}
      ctx.drawImage(foto, (W - bw) / 2, (H - bh) / 2, bw, bh);
      try { (ctx as any).filter = "none"; } catch {}
      ctx.fillStyle = "rgba(16,20,44,0.55)";
      ctx.fillRect(0, 0, W, H);
    }
    const dw = fw * cover * zoom, dh = fh * cover * zoom;
    ctx.drawImage(foto, (W - dw) / 2 + (e.x || 0) * W, (H - dh) / 2 + (e.y || 0) * H, dw, dh);
  }

  // 2. Sombras suaves arriba y abajo para que el texto se lea sobre cualquier foto
  const gTop = ctx.createLinearGradient(0, 0, 0, top + 260 * u);
  gTop.addColorStop(0, "rgba(16,20,44,0.62)");
  gTop.addColorStop(1, "rgba(16,20,44,0)");
  ctx.fillStyle = gTop;
  ctx.fillRect(0, 0, W, top + 260 * u);

  const alto = (o.formato === "historia" ? 760 : 560) * u;
  const gBot = ctx.createLinearGradient(0, H - alto, 0, H);
  gBot.addColorStop(0, "rgba(16,20,44,0)");
  gBot.addColorStop(0.45, "rgba(16,20,44,0.72)");
  gBot.addColorStop(1, "rgba(16,20,44,0.94)");
  ctx.fillStyle = gBot;
  ctx.fillRect(0, H - alto, W, alto);

  // 3. Logo arriba a la izquierda
  try {
    const iso = await cargarIsotipo();
    const ih = 92 * u, iw = ih * (124 / 116);
    ctx.drawImage(iso, M - 6 * u, top + M - 8 * u, iw, ih);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(44 * u)}px Montserrat, system-ui, sans-serif`;
    const lx = M + iw + 6 * u;
    ctx.fillText("VORTEX", lx, top + M + 38 * u);
    const vw = ctx.measureText("VORTEX").width;
    ctx.fillStyle = TEAL;
    ctx.beginPath();
    ctx.moveTo(lx + vw + 6 * u, top + M + 2 * u);
    ctx.lineTo(lx + vw + 26 * u, top + M + 2 * u);
    ctx.lineTo(lx + vw + 18 * u, top + M + 14 * u);
    ctx.lineTo(lx + vw - 2 * u, top + M + 14 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#9ff3f5";
    ctx.font = `600 ${Math.round(20 * u)}px Montserrat, system-ui, sans-serif`;
    (ctx as any).letterSpacing = `${Math.round(8 * u)}px`;
    ctx.fillText("SNEAKERS", lx + 2 * u, top + M + 70 * u);
    (ctx as any).letterSpacing = "0px";
  } catch {}

  // 4. Código del par arriba a la derecha
  if (o.mostrar.codigo && o.codigo) {
    ctx.font = `700 ${Math.round(34 * u)}px Montserrat, system-ui, sans-serif`;
    const tw = ctx.measureText(o.codigo).width;
    const cw = tw + 44 * u, ch = 64 * u;
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    rect(ctx, W - M - cw, top + M + 4 * u, cw, ch, 14 * u);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textBaseline = "middle";
    ctx.fillText(o.codigo, W - M - cw + 22 * u, top + M + 4 * u + ch / 2 + 2 * u);
  }

  // 5. Bloque inferior: título, precio y datos
  const ancho = W - M * 2;
  let y = H - M - (o.formato === "historia" ? 120 * u : 0);

  // barra de marca al pie
  const gBar = ctx.createLinearGradient(0, 0, W, 0);
  gBar.addColorStop(0, TEAL);
  gBar.addColorStop(1, LILA);
  ctx.fillStyle = gBar;
  ctx.fillRect(0, H - 12 * u, W, 12 * u);

  ctx.textBaseline = "alphabetic";
  if (o.extra && o.extra.trim()) {
    const px = ajustar(ctx, o.extra.trim(), 600, Math.round(34 * u), Math.round(26 * u), ancho);
    ctx.font = `600 ${px}px Montserrat, system-ui, sans-serif`;
    ctx.fillStyle = "#9ff3f5";
    ctx.fillText(o.extra.trim(), M, y);
    y -= px + 30 * u;
  }

  const chips = [];
  if (o.mostrar.talla && o.talla) chips.push([`Talla ${o.talla}`, TEAL, INK]);
  if (o.mostrar.cm && o.cm) chips.push([`${String(o.cm).replace(".", ",")} cm`, VIOLET, "#ffffff"]);
  if (chips.length) {
    const ch = 72 * u;
    y -= ch;
    let x = M;
    chips.forEach(([t, bg, fg]) => { x += chip(ctx, x, y, t, bg, fg, u) + 16 * u; });
    y -= 34 * u;
  }

  ctx.textBaseline = "alphabetic";
  if (o.mostrar.precio && o.precio) {
    const px = ajustar(ctx, o.precio, 800, Math.round(150 * u), Math.round(70 * u), ancho);
    ctx.font = `800 ${px}px Montserrat, system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(o.precio, M - 4 * u, y);
    y -= px * 0.98;
  }

  if (o.mostrar.titulo && o.titulo) {
    const px = ajustar(ctx, o.titulo, 600, Math.round(46 * u), Math.round(36 * u), ancho);
    ctx.font = `600 ${px}px Montserrat, system-ui, sans-serif`;
    let t = o.titulo;
    while (t.length > 3 && ctx.measureText(t).width > ancho) t = t.slice(0, -2).trimEnd() + "…";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(t, M, y);
  }
}

export function lienzoABlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo crear la imagen."))), "image/jpeg", 0.92));
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
