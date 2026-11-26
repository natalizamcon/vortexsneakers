// Botón "atrás" del celular (y del navegador) dentro de la app.
// Siempre dejamos una entrada de "guardia" en el historial: cuando la persona
// presiona atrás, en vez de salir de la app se cierra la ventana abierta,
// o se vuelve a la página anterior. En la página de inicio hay que presionar
// atrás dos veces seguidas para salir.
import { useEffect, useRef } from "react";

type Fn = () => void;
const capas: Fn[] = [];                 // ventanas abiertas (la última es la de arriba)
const paginas: (() => boolean)[] = [];  // quién maneja "atrás" entre páginas (la última manda)
let avisar: (t: string) => void = () => {};
let urlActual = "";
let ultimoAtras = 0;
let iniciado = false;
let saliendo = false;

const poner = () => {
  try { window.history.pushState({ vxGuardia: true }, "", urlActual || window.location.href); } catch {}
};

export function iniciarAtras() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  urlActual = window.location.pathname + window.location.search;
  poner();
  window.addEventListener("popstate", () => {
    if (saliendo) return;
    const capa = capas[capas.length - 1];
    if (capa) { capa(); poner(); return; }
    const pagina = paginas[paginas.length - 1];
    if (pagina && pagina()) { poner(); return; }
    const ahora = Date.now();
    if (ahora - ultimoAtras < 2500) { saliendo = true; window.history.back(); return; }
    ultimoAtras = ahora;
    avisar("Presiona atrás otra vez para salir");
    poner();
  });
}

/** Mensaje que se muestra al pedir confirmación para salir */
export function fijarAvisoSalir(f: (t: string) => void) { avisar = f; }

/** La app cambió de página: actualiza la dirección sin crear entradas nuevas en el historial */
export function cambiarUrl(ruta: string) {
  urlActual = ruta;
  try { window.history.replaceState({ vxGuardia: true }, "", ruta); } catch {}
}

/** Mientras `activo` sea verdadero, el botón atrás llama a `cerrar` (para ventanas, menús, visores…) */
export function useAtras(activo: any, cerrar: Fn) {
  const ref = useRef(cerrar);
  ref.current = cerrar;
  useEffect(() => {
    if (!activo) return;
    const f = () => ref.current();
    capas.push(f);
    return () => { const i = capas.lastIndexOf(f); if (i >= 0) capas.splice(i, 1); };
  }, [!!activo]);
}

/** Atrás entre páginas: `fn` devuelve verdadero si se encargó (volvió a otra página) */
export function usePaginaAtras(fn: () => boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const f = () => ref.current();
    paginas.push(f);
    return () => { const i = paginas.lastIndexOf(f); if (i >= 0) paginas.splice(i, 1); };
  }, []);
}
