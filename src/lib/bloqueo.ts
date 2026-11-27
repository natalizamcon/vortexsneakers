// Mientras hay una ventana abierta, la página de atrás NO se mueve (también en iPhone)
// y no se activa el "jalar para recargar" del navegador.
import { useEffect, useState } from "react";

let abiertas = 0;
let posicion = 0;

function bloquear() {
  if (abiertas++ > 0) return;
  posicion = window.scrollY;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${posicion}px`;
  b.left = "0";
  b.right = "0";
  b.width = "100%";
  document.documentElement.classList.add("vx-bloqueado");
}

function desbloquear() {
  if (abiertas === 0) return;
  if (--abiertas > 0) return;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = "";
  document.documentElement.classList.remove("vx-bloqueado");
  window.scrollTo(0, posicion);
}

export function useBloquearScroll(activo = true) {
  useEffect(() => {
    if (!activo) return;
    bloquear();
    return desbloquear;
  }, [activo]);
}

/** Área visible real de la pantalla (en el celular se achica cuando aparece el teclado) */
export function useAreaVisible() {
  const leer = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return vv ? { alto: vv.height, arriba: vv.offsetTop } : { alto: typeof window !== "undefined" ? window.innerHeight : 800, arriba: 0 };
  };
  const [area, setArea] = useState(leer);
  useEffect(() => {
    const vv = window.visualViewport;
    const act = () => setArea(leer());
    vv?.addEventListener("resize", act);
    vv?.addEventListener("scroll", act);
    window.addEventListener("resize", act);
    return () => { vv?.removeEventListener("resize", act); vv?.removeEventListener("scroll", act); window.removeEventListener("resize", act); };
  }, []);
  return area;
}
