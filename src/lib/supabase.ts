import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../config";

const env: any = (import.meta as any).env || {};
export const SB_URL: string = (env.VITE_SUPABASE_URL || SUPABASE_URL || "").trim();
export const SB_KEY: string = (env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY || "").trim();

/** true cuando ya se pegaron la URL y la clave reales en src/config.ts */
export const configurado = /^https:\/\/.+\..+/.test(SB_URL) && !SB_URL.includes("TU-PROYECTO") && SB_KEY.length > 20 && !SB_KEY.includes("PEGA-AQUI");

export const supabase: any = configurado
  ? createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const BUCKET = "productos";
export const BUCKET_COMPROBANTES = "comprobantes"; // carpeta privada: solo el cliente dueño y el personal de ventas

export const fotoUrl = (ruta: string) => (supabase ? supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl : "");

/** Mensajes de error de Supabase en lenguaje claro */
export function mensajeError(e: any): string {
  const m = String(e?.message || e || "Ocurrió un error.");
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Ese usuario no está confirmado. En Supabase marca “Auto Confirm User” al crearlo.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Sin conexión. Revisa tu internet e inténtalo otra vez.";
  if (/clientes_telefono_uq/i.test(m)) return "Ya existe un cliente con ese teléfono.";
  if (/reservas_una_activa/i.test(m)) return "Ese par ya tiene una reserva activa.";
  if (/venta_items_un_par/i.test(m)) return "Ese par ya está en otra venta.";
  if (/Bucket not found/i.test(m)) return "Falta la carpeta de fotos “productos” en Supabase Storage.";
  if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para esta acción.";
  if (/JWT expired/i.test(m)) return "Tu sesión venció. Vuelve a iniciar sesión.";
  // La app es más nueva que la base de datos: falta ejecutar el último script de actualización
  if (e?.code === "PGRST202" || /Could not find the function|schema cache/i.test(m)) {
    const fn = (m.match(/function\s+public\.(\w+)/i) || [])[1];
    return `Falta actualizar la base de datos${fn ? ` (no existe “${fn}”)` : ""}. En Supabase abre SQL Editor, ejecuta el último archivo de actualización y vuelve a intentarlo.`;
  }
  if (/column .* does not exist/i.test(m)) return "Falta actualizar la base de datos. En Supabase ejecuta el último archivo de actualización y recarga la página.";
  return m.replace(/^.*?ERROR:\s*/, "");
}

/** Reduce el tamaño de las fotos del celular antes de subirlas (máx. 1600 px) */
export async function comprimirImagen(file: File, max = 1600, calidad = 0.82): Promise<Blob> {
  try {
    const bmp: any = await (window as any).createImageBitmap(file);
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b || file), "image/jpeg", calidad));
  } catch {
    return file;
  }
}
