// =====================================================================
//  👉 CONEXIÓN CON SUPABASE: cambia SOLO estas dos líneas
//  Los datos están en Supabase → Project Settings → API (o "Data API"):
//    • Project URL            → SUPABASE_URL
//    • Publishable / anon key → SUPABASE_KEY
//  Esta clave es pública por diseño: la seguridad la dan las reglas de
//  la base de datos. NUNCA pegues aquí la "service_role" / "secret" key.
// =====================================================================

export const SUPABASE_URL = "https://tqktrwvyztyjbofnqbib.supabase.co";
export const SUPABASE_KEY = "sb_publishable_5U43MKD3MnRP7kZvF_Q_nQ_E71AsEtb";

// (Opcional) Si prefieres usar variables de entorno en Netlify:
// VITE_SUPABASE_URL y VITE_SUPABASE_KEY tienen prioridad sobre lo de arriba.
