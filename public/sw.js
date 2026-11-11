// Service worker mínimo: permite instalar VORTEX en el celular.
// No guarda datos del negocio: todo se lee siempre en vivo desde Supabase.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
