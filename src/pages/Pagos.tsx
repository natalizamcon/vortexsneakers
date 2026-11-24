// Revisión de comprobantes de pago que suben los clientes de la tienda en línea.
// Al aprobar: se registra la venta pagada, se fija la fecha de envío y la foto del comprobante se borra.
import { useState, useEffect } from "react";
import { CheckCircle2, X, FileText, Phone, MapPin, Truck, AlertTriangle } from "lucide-react";
import { Btn, Field, Input, Select, Modal, Note, ProductPhoto, Spinner, useBusy } from "../components/ui";
import { bs0, fdate, ftime, addDays, TODAY } from "../lib/utils";
import { waLink } from "./Sales";

export const entregaWeb = (e) => {
  if (!e?.entrega) return "";
  if (e.modo === "cochabamba") return `Paquetería en Cochabamba${e.transportista ? ` (${e.transportista})` : ""}`;
  if (e.entrega === "Recojo en punto") return "Recoge en tienda";
  if (e.entrega === "Delivery Cochabamba") return `Envío a domicilio${e.direccion ? `: ${e.direccion}` : ""}`;
  return `Envío a ${e.destino || "otra ciudad"}${e.transportista ? ` por ${e.transportista}` : ""}`;
};

const MOTIVOS = ["El monto no coincide", "No se ve bien el comprobante", "No encontramos el pago en el banco"];

export function RevisarPagoModal({ db, comprobanteId, actions, client, onClose, can }) {
  const c = db.comprobantes.find((x) => x.id === comprobanteId);
  const [url, setUrl] = useState("");
  const [cargando, setCargando] = useState(true);
  const [rechazar, setRechazar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, run] = useBusy();
  const reservas = c ? db.reservations.filter((r) => r.pedidoWeb === c.pedido && r.estado === "Activa") : [];
  const pares = reservas.map((r) => ({ r, p: db.products.find((p) => p.id === r.productId) })).filter((x) => x.p);
  const total = pares.reduce((a, x) => a + x.p.precio, 0);
  const adelantos = db.payments.filter((pg) => reservas.some((r) => r.id === pg.reservaId) && !pg.anulado && !pg.ventaId).reduce((a, pg) => a + pg.monto, 0);
  const metodos = db.config.metodos.length ? db.config.metodos : ["QR"];
  const [d, setD] = useState({ monto: String(Math.max(0, total - adelantos) || ""), metodo: metodos.includes("QR") ? "QR" : metodos[0], fecha: addDays(TODAY, 1), guia: "" });
  useEffect(() => {
    let vivo = true;
    if (c?.ruta) actions.urlComprobante(c.ruta).then((u) => { if (vivo) { setUrl(u); setCargando(false); } });
    else setCargando(false);
    return () => { vivo = false; };
  }, [c?.ruta]);
  if (!c) return null;
  const cl = client(c.clienteId);
  const envio = reservas[0]?.envio || db.reservations.find((r) => r.pedidoWeb === c.pedido)?.envio || {};
  const esPdf = /\.pdf$/i.test(c.ruta);
  const revisado = c.estado !== "En revisión";
  const montoNum = Number(d.monto || 0);
  const montoMal = d.monto !== "" && (montoNum < 0 || montoNum > total - adelantos + 0.001);
  const puedeAprobar = can?.sell !== false && !revisado;

  return (
    <Modal wide title={`Pago del pedido ${c.pedido}`} onClose={onClose} footer={revisado ? <Btn variant="ghost" onClick={onClose}>Cerrar</Btn> : rechazar ? <>
      <Btn variant="ghost" onClick={() => setRechazar(false)}>Volver</Btn>
      <Btn variant="danger" disabled={busy || motivo.trim().length < 4} onClick={() => run(async () => { if (await actions.rechazarPago(c, motivo.trim())) onClose(); })}>{busy ? <Spinner /> : <X size={15} />} Rechazar comprobante</Btn>
    </> : <>
      <Btn variant="danger" disabled={!puedeAprobar} onClick={() => setRechazar(true)}><X size={15} /> Rechazar</Btn>
      <Btn disabled={busy || !puedeAprobar || montoMal} onClick={() => run(async () => { if (await actions.aprobarPago(c, d)) onClose(); })}>{busy ? <Spinner /> : <CheckCircle2 size={15} />} Aprobar pago</Btn>
    </>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-1.5">Comprobante que subió el cliente</div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 min-h-48 grid place-items-center overflow-hidden">
            {!c.ruta ? <p className="text-sm text-slate-500 p-6 text-center">{c.estado === "Aprobado" ? "El comprobante ya se borró porque el pago fue aprobado." : "La imagen ya no está disponible."}</p>
              : cargando ? <span className="text-sm text-slate-500 flex items-center gap-2"><Spinner /> Cargando…</span>
              : !url ? <p className="text-sm text-rose-600 p-6 text-center">No se pudo abrir el comprobante.</p>
              : esPdf ? <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 p-8 text-purple-700 font-semibold"><FileText size={36} /> Abrir comprobante (PDF)</a>
              : <a href={url} target="_blank" rel="noreferrer" className="block w-full" title="Abrir en grande"><img src={url} alt="Comprobante de pago" className="w-full max-h-[28rem] object-contain bg-white" /></a>}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">Subido {ftime(c.creado)}{c.monto ? ` · el cliente dice que pagó ${bs0(c.monto)}` : ""}</div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="font-semibold">{cl?.nombre || "Cliente"}</div>
            {cl?.telefono && <a className="text-purple-700 flex items-center gap-1 mt-0.5" href={waLink(cl.telefono, `Hola ${cl.nombre.split(" ")[0]}, te escribimos de VORTEX SNEAKERS por el pago de tu pedido ${c.pedido}.`)} target="_blank" rel="noreferrer"><Phone size={13} /> {cl.telefono} · WhatsApp</a>}
            <div className="text-slate-600 flex items-start gap-1 mt-1"><MapPin size={13} className="mt-0.5 shrink-0" />{entregaWeb(envio)}</div>
            {envio.recibe && <div className="text-slate-600 text-xs mt-0.5">Recoge: {envio.recibe}{envio.ci ? ` · CI ${envio.ci}` : ""}</div>}
          </div>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {pares.map(({ r, p }) => (
              <div key={r.id} className="flex items-center gap-2.5 p-2">
                <div className="w-12 h-9 rounded overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
                <div className="flex-1 min-w-0 text-sm"><div className="font-medium truncate">{p.codigo} · {p.marca} {p.modelo}</div><div className="text-xs text-slate-500">Talla {p.talla}</div></div>
                <span className="vx-num text-sm font-semibold">{bs0(p.precio)}</span>
              </div>
            ))}
            {!pares.length && <p className="p-3 text-sm text-slate-500">Este pedido ya no tiene pares apartados.</p>}
            {pares.length > 0 && <div className="flex justify-between p-2.5 text-sm font-semibold"><span>Total del pedido</span><span className="vx-num">{bs0(total)}</span></div>}
          </div>
          {c.monto && Math.abs(c.monto - (total - adelantos)) > 0.5 && pares.length > 0 && <Note tone="rose">El cliente indicó {bs0(c.monto)} y el pedido es de {bs0(total - adelantos)}. Revisa en tu banco cuánto llegó.</Note>}

          {revisado ? (
            <Note>{c.estado === "Aprobado" ? `Pago aprobado${c.ventaId ? ` · venta ${c.ventaId}` : ""}.` : `Rechazado: ${c.motivo}`}</Note>
          ) : rechazar ? (
            <div className="space-y-2">
              <Field label="¿Por qué lo rechazas? (el cliente lo verá)"><Input value={motivo} maxLength={200} autoFocus onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: el monto no coincide" /></Field>
              <div className="flex flex-wrap gap-1.5">{MOTIVOS.map((m) => <button key={m} onClick={() => setMotivo(m)} className="text-xs rounded-full border border-slate-300 px-2.5 py-1 hover:bg-slate-50">{m}</button>)}</div>
              <p className="text-xs text-slate-500">El pedido se cancela y los pares vuelven al catálogo. El cliente verá el motivo y tu WhatsApp.</p>
            </div>
          ) : !pares.length ? (
            <Note tone="rose">Este pedido ya no tiene pares apartados: otra persona pagó primero. Recházalo (ej.: “otra persona pagó primero, te devolvemos tu dinero”) y escríbele al cliente. Si ya registraste la venta a mano, toca <b>Aprobar pago</b> solo para cerrar el comprobante.</Note>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monto que llegó (Bs)" hint={montoMal ? "No puede ser mayor al total." : "Revisa que coincida con tu banco."}><Input type="number" inputMode="decimal" value={d.monto} onChange={(e) => setD({ ...d, monto: e.target.value })} /></Field>
                <Field label="Método"><Select value={d.metodo} onChange={(e) => setD({ ...d, metodo: e.target.value })} options={metodos} /></Field>
                <Field label={envio.modo === "cochabamba" ? "Fecha en que lo dejas en paquetería" : "Fecha de envío"}><Input type="date" value={d.fecha} min={TODAY} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></Field>
                <Field label="N.º de guía (opcional)" hint="Puedes ponerlo después."><Input value={d.guia} maxLength={80} onChange={(e) => setD({ ...d, guia: e.target.value })} placeholder="Ej.: 123456" /></Field>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1.5"><Truck size={13} className="mt-0.5 shrink-0" /><span>Al aprobar se registra la venta, los pares pasan al historial, el cliente ve su envío en “Mis pedidos” y <b>la foto del comprobante se borra</b>.</span></p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Aviso con los comprobantes por revisar (para Reservas y el Panel) */
export function ComprobantesPendientes({ db, client, setModal }) {
  const pend = db.comprobantes.filter((c) => c.estado === "En revisión");
  if (!pend.length) return null;
  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-900 flex items-center gap-1.5"><AlertTriangle size={15} /> {pend.length} comprobante{pend.length === 1 ? "" : "s"} de pago por revisar</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {pend.map((c) => (
          <button key={c.id} onClick={() => setModal({ type: "revisarPago", comprobanteId: c.id })} className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
            {c.pedido} · {client(c.clienteId)?.nombre?.split(" ")[0] || "Cliente"}{c.monto ? ` · ${bs0(c.monto)}` : ""} · Revisar
          </button>
        ))}
      </div>
    </div>
  );
}
