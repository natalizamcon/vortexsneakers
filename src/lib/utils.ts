// Utilidades, catálogos y cálculos del negocio
// Fecha y hora "en vivo": se actualizan cada minuto con tick()
export const C = { teal: "#08BFC5", tealD: "#068f94", lila: "#B76AF2", lilaD: "#7928CA", gray: "#A3A9BF", ink: "#10142C" };

export const pad2 = (n) => String(n).padStart(2, "0");
export const isoLocal = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export let NOW = new Date();
export let TODAY = isoLocal(NOW);
export function tick() { NOW = new Date(); TODAY = isoLocal(NOW); }

export const addDays = (iso, d) => { const t = new Date(iso + "T12:00:00"); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };
export const diffDays = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
export const bs = (n) => "Bs " + Number(n || 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const bs0 = (n) => "Bs " + Math.round(n || 0).toLocaleString("es-BO");
export const fdate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
export const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
export const ftime = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const COLORS = [["Blanco", "#eef2f6"], ["Negro", "#1f2937"], ["Gris", "#9ca3af"], ["Azul marino", "#1e3a8a"], ["Beige", "#d6c7a1"], ["Rojo", "#dc2626"], ["Verde", "#15803d"], ["Rosa", "#f9a8d4"], ["Azul", "#3b82f6"], ["Café", "#78350f"], ["Morado", "#7c3aed"], ["Amarillo", "#facc15"], ["Naranja", "#f97316"], ["Multicolor", "#a3a9bf"], ["Celeste", "#7dd3fc"], ["Crema", "#f3ead2"], ["Plateado", "#cbd5e1"], ["Dorado", "#d4a72c"], ["Lila", "#c4b5fd"], ["Turquesa", "#2dd4bf"], ["Vino", "#7f1d1d"], ["Verde oliva", "#6b7d3a"], ["Blanco y negro", "#9ca3af"]];
export const ESTADOS_PEDIDO = ["Pendiente de preparación", "Preparando", "Listo para entregar", "Enviado", "Entregado"];
export const DEPARTAMENTOS = ["La Paz", "Santa Cruz", "Oruro", "Potosí", "Chuquisaca (Sucre)", "Tarija", "Beni (Trinidad)", "Pando (Cobija)", "Cochabamba (provincias)"];
export const TIPOS_EVENTO = {
  "Envío": "#08BFC5", "Llegada de fardo": "#7928CA", "Facebook Live": "#B76AF2", "Cobro": "#e11d48",
  "Pago a proveedor": "#d97706", "Reserva": "#f59e0b", "Otro": "#64748b",
};
export const RECORDATORIOS = [[0, "Sin recordatorio"], [30, "30 minutos antes"], [60, "1 hora antes"], [180, "3 horas antes"], [1440, "1 día antes"], [2880, "2 días antes"]];
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const evDate = (e) => new Date(`${e.fecha}T${e.hora || "09:00"}:00`);
export const fechaLarga = (iso) => { const d = new Date(iso + "T12:00:00"); return `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const recLabel = (m) => (RECORDATORIOS.find((r) => r[0] === m) || [0, ""])[1];
export function agendaEvents(db) {
  const manual = db.events.map((e) => ({ ...e, auto: false }));
  const envios = db.sales.filter((s) => s.estado === "Activa" && !["Enviado", "Entregado"].includes(s.pedido) && s.entrega.tipo !== "Recojo en punto").map((s) => {
    const c = db.clients.find((x) => x.id === s.clienteId);
    return { id: "auto-" + s.id, auto: true, ventaId: s.id, tipo: "Envío", titulo: `Enviar ${s.id} a ${s.entrega.destino || c?.zona}`, fecha: s.entrega.fechaEstimada, hora: "10:00", recordatorio: 1440, notas: `${c?.nombre} · ${s.items.length} par(es) · ${s.entrega.tipo}`, hecho: false };
  });
  const reservas = db.reservations.filter((r) => r.estado === "Activa").map((r) => {
    const d = new Date(r.vence), c = db.clients.find((x) => x.id === r.clienteId), p = db.products.find((x) => x.id === r.productId);
    return { id: "auto-" + r.id, auto: true, reservaId: r.id, tipo: "Reserva", titulo: `Vence la reserva de ${p?.codigo}`, fecha: isoLocal(d), hora: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, recordatorio: 180, notas: `${r.id} · ${c?.nombre}`, hecho: false };
  });
  return [...manual, ...envios, ...reservas].sort((a, b) => evDate(a) - evDate(b));
}
export const reminderState = (e) => {
  if (e.hecho || !e.recordatorio) return null;
  const at = evDate(e).getTime(), r = at - e.recordatorio * 60000, now = NOW.getTime();
  if (now >= r && now <= at) return "activo";
  if (now > at && now - at < 2 * 86400000) return "atrasado";
  return null;
};
export const TIPOS_ENTREGA = [["Recojo en punto", "Recojo"], ["Delivery Cochabamba", "Delivery"], ["Encomienda", "Encomienda"]];
export const GASTO_CATS = ["Delivery", "Empaques", "Publicidad", "Comisiones", "Transporte de fardos", "Otros gastos"];
export const saleTotal = (s) => sum(s.items, (x) => x.precio);
export const saleCost = (s) => sum(s.items, (x) => x.costo);
export const paidOf = (db, ventaId) => sum(db.payments.filter((p) => p.ventaId === ventaId && !p.anulado), (p) => p.monto);
export const payState = (db, s) => {
  if (s.estado === "Anulada") return db.payments.some((p) => p.ventaId === s.id) ? "Reembolsado" : "Anulada";
  const paid = paidOf(db, s.id), t = saleTotal(s);
  return paid >= t ? "Pagado" : paid > 0 ? "Parcial" : "Pendiente";
};
export const lotTotal = (l) => l.compra + l.transporte + l.otros;
export const pCost = (p) => p.costoCompra + p.costoTransporte;
export function computeMetrics(db) {
  // Los pares eliminados no cuentan como inventario; los dados de baja por pérdida restan de la ganancia
  const P = db.products.filter((p) => p.estado !== "Eliminado");
  const bajas = db.products.filter((p) => p.estado === "Eliminado" && !String(p.bajaMotivo || "").startsWith("Cargado por error"));
  const costoBajas = sum(bajas, pCost);
  const active = db.sales.filter((s) => s.estado === "Activa");
  const ventas = sum(active, saleTotal);
  const cobradoVentas = sum(active, (s) => paidOf(db, s.id));
  const activeRes = new Set(db.reservations.filter((r) => r.estado === "Activa").map((r) => r.id));
  const adelantos = sum(db.payments.filter((p) => !p.anulado && !p.ventaId && activeRes.has(p.reservaId)), (p) => p.monto);
  const cobrado = cobradoVentas + adelantos;
  const costoVendido = sum(active, saleCost);
  const gastos = sum(db.expenses.filter((e) => !e.anulado), (e) => e.monto);
  const otros = sum(db.otherIncome, (e) => e.monto);
  const bruta = ventas - costoVendido;
  const neta = bruta - gastos - costoBajas + otros;
  const inversion = sum(db.lots, lotTotal);
  const recuperado = Math.max(0, cobrado + otros - gastos);
  const stock = P.filter((p) => p.estado !== "Vendido");
  return {
    total: P.length, disp: P.filter((p) => p.estado === "Disponible").length, res: P.filter((p) => p.estado === "Reservado").length,
    vend: P.filter((p) => p.estado === "Vendido").length, ventas, cobrado, cobradoVentas, adelantos, pendiente: ventas - cobradoVentas,
    costoVendido, gastos, otros, bruta, neta, costoBajas, nBajas: bajas.length, inversion, recuperado, porRecuperar: Math.max(0, inversion - recuperado),
    invCosto: sum(stock, pCost), invPrecio: sum(stock, (p) => p.precio),
    ventasHoy: sum(active.filter((s) => s.fecha === TODAY), saleTotal), ventasMes: sum(active.filter((s) => s.fecha.startsWith(TODAY.slice(0, 7))), saleTotal),
    paresMes: sum(active.filter((s) => s.fecha.startsWith(TODAY.slice(0, 7))), (s) => s.items.length),
    ticket: active.length ? ventas / active.length : 0, active,
  };
}


export const MARCAS = ["Nike", "Adidas", "New Balance", "Converse", "Vans", "Reebok", "Puma", "Fila", "Asics", "Jordan", "Skechers", "Under Armour", "Saucony", "Brooks", "Hoka", "On"];
/** Color para el dibujo del par. Acepta colores escritos a mano ("blanco con rojo" → blanco). */
export const colorHex = (nombre) => {
  const t = String(nombre || "").trim().toLowerCase();
  const exacto = COLORS.find((c) => c[0].toLowerCase() === t);
  if (exacto) return exacto[1];
  const parecido = [...COLORS].sort((a, b) => b[0].length - a[0].length).find((c) => t.includes(c[0].toLowerCase()));
  return parecido ? parecido[1] : "#cbd5e1";
};
/** "27" → "27 cm" ; vacío → "" */
export const fcm = (cm) => (cm ? `${String(cm).replace(".", ",")} cm` : "");
export const ROLES = { admin: "Administrador", vendedor: "Vendedor", inventario: "Encargado de inventario" };
/** Qué secciones ve cada rol */
export const ACCESO = {
  admin: ["dashboard", "agenda", "inventario", "lotes", "reservas", "ventas", "pedidos", "clientes", "finanzas", "reportes", "usuarios", "actividad", "config"],
  vendedor: ["agenda", "inventario", "reservas", "ventas", "pedidos", "clientes"],
  inventario: ["agenda", "inventario", "lotes", "pedidos"],
};
export const permisos = (rol) => ({
  admin: rol === "admin",
  sell: rol === "admin" || rol === "vendedor",
  inv: rol === "admin" || rol === "inventario",
});

/** Exporta una tabla a un archivo que abre Excel (CSV con separador ;) */
export function exportarCSV(nombre, filas) {
  if (!filas.length) return;
  const cols = Object.keys(filas[0]);
  const esc = (v) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const txt = [cols.join(";"), ...filas.map((f) => cols.map((c) => esc(typeof f[c] === "number" ? String(f[c]).replace(".", ",") : f[c])).join(";"))].join("\r\n");
  const blob = new Blob(["\ufeff" + txt], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
