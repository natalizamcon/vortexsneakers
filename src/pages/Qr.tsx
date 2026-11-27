// QR de pago: se sube una vez y se asigna a uno o varios pares (por ejemplo, todos los de Bs 180).
import { useState, useMemo, useEffect } from "react";
import { QrCode, Plus, Trash2, Pencil, Share2, Download, Search, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Btn, Field, Input, Modal, Note, ProductPhoto, Spinner, useBusy, inputCls } from "../components/ui";
import { PhotoPicker, PhotoViewer } from "../components/photos";
import { bs0, norm } from "../lib/utils";

const montoTxt = (q) => (q?.monto ? bs0(q.monto) : "Monto libre");
const usos = (db, q) => db.products.filter((p) => p.qrId === q.id && p.estado !== "Eliminado");

/** Ver un QR en grande para mostrarlo, descargarlo o compartirlo por WhatsApp */
export function QrViewModal({ db, qrId, onClose, toast }) {
  const q = db.qrs.find((x) => x.id === qrId);
  const [busy, run] = useBusy();
  if (!q) return null;
  const archivo = async () => {
    const r = await fetch(q.url);
    const b = await r.blob();
    return new File([b], `${q.nombre || "QR"}.${(b.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: b.type || "image/png" });
  };
  const nav: any = typeof navigator !== "undefined" ? navigator : {};
  const compartir = () => run(async () => {
    try {
      const f = await archivo();
      if (nav.canShare && nav.canShare({ files: [f] })) await nav.share({ files: [f], title: q.nombre, text: `Pago VORTEX SNEAKERS · ${montoTxt(q)}` });
      else descargar();
    } catch {}
  });
  const descargar = () => run(async () => {
    try {
      const f = await archivo();
      const u = URL.createObjectURL(f);
      const a = document.createElement("a"); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch { toast && toast("No se pudo descargar el QR. Revisa tu conexión.", "err"); }
  });
  return (
    <Modal title={q.nombre || "QR de pago"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      {nav.share && <Btn variant="outline" disabled={busy} onClick={compartir}><Share2 size={15} /> Compartir</Btn>}
      <Btn disabled={busy} onClick={descargar}>{busy ? <Spinner /> : <Download size={15} />} Descargar</Btn>
    </>}>
      <div className="rounded-xl bg-white border border-slate-200 p-3"><img src={q.url} alt={`QR de pago ${montoTxt(q)}`} className="w-full max-h-96 object-contain" /></div>
      <div className="text-center"><div className="vx-d text-2xl font-bold">{montoTxt(q)}</div><div className="text-xs text-slate-500">Usado en {usos(db, q).length} par{usos(db, q).length === 1 ? "" : "es"}</div></div>
    </Modal>
  );
}

/** Formulario para subir un QR nuevo (desde la galería o con la cámara) */
function NuevoQr({ montoInicial = "" as any, onCancel, onGuardar, busy }) {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [monto, setMonto] = useState(montoInicial ? String(montoInicial) : "");
  const [nombre, setNombre] = useState("");
  const [ver, setVer] = useState(false);
  useEffect(() => { if (!file) return; const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  const montoOk = monto === "" || Number(monto) > 0;
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 space-y-3">
      <div className="text-sm font-semibold text-slate-900">Subir un QR nuevo</div>
      <div className="flex gap-3 items-start">
        <div className={`${url ? "w-40 h-40" : "w-28 h-28"} shrink-0 rounded-lg bg-white border border-slate-200 grid place-items-center overflow-hidden relative`}>
          {url ? <button type="button" onClick={() => setVer(true)} className="w-full h-full" aria-label="Ver el QR en grande"><img src={url} alt="QR elegido" className="w-full h-full object-contain" /><span className="absolute bottom-1 right-1 text-[10px] font-semibold bg-slate-900/70 text-white rounded px-1">Ampliar</span></button> : <QrCode size={36} className="text-slate-300" />}
          {ver && url && <PhotoViewer urls={[url]} title="QR elegido" onClose={() => setVer(false)} />}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2 flex-wrap"><PhotoPicker compact max={1} onFiles={(fs) => fs[0] && setFile(fs[0])} /></div>
          <p className="text-xs text-slate-500">Usa la imagen del QR que genera tu banco (captura o foto bien enfocada).</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto del QR (Bs)" hint={montoOk ? "Déjalo vacío si el QR es de monto libre." : "Escribe un monto mayor a cero."}><Input type="number" inputMode="decimal" value={monto} placeholder="Ej.: 180" onChange={(e) => setMonto(e.target.value)} /></Field>
        <Field label="Nombre (opcional)"><Input value={nombre} placeholder={monto ? `QR Bs ${monto}` : "Ej.: QR BNB"} maxLength={60} onChange={(e) => setNombre(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={onCancel}>Cancelar</Btn>
        <Btn size="sm" disabled={busy || !file || !montoOk} onClick={() => onGuardar({ file, monto, nombre })}>{busy ? <Spinner /> : null} Guardar QR</Btn>
      </div>
    </div>
  );
}

/** Elegir pares para un QR. Marca por defecto los del mismo precio. */
function ElegirPares({ db, qr, monto, seleccion, setSeleccion }) {
  const [q, setQ] = useState("");
  const [soloPrecio, setSoloPrecio] = useState(!!monto);
  const candidatos = useMemo(() => db.products
    .filter((p) => p.estado === "Disponible" || p.estado === "Reservado")
    .filter((p) => !soloPrecio || !monto || Number(p.precio) === Number(monto))
    .filter((p) => norm(`${p.codigo} ${p.marca} ${p.modelo} ${p.talla} ${p.color}`).includes(norm(q)))
    .sort((a, b) => a.codigo.localeCompare(b.codigo)), [db.products, soloPrecio, monto, q]);
  const todos = candidatos.length > 0 && candidatos.every((p) => seleccion.has(p.id));
  const alternar = (id) => { const n = new Set(seleccion); n.has(id) ? n.delete(id) : n.add(id); setSeleccion(n); };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-40"><Search size={15} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" /><input className={inputCls + " pl-9 py-1.5"} placeholder="Buscar par" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {monto ? <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" className="w-4 h-4 accent-purple-700" checked={soloPrecio} onChange={(e) => setSoloPrecio(e.target.checked)} /> Solo pares de {bs0(monto)}</label> : null}
        <button className="text-xs font-semibold text-purple-700" onClick={() => { const n = new Set(seleccion); candidatos.forEach((p) => (todos ? n.delete(p.id) : n.add(p.id))); setSeleccion(n); }}>{todos ? "Quitar todos" : `Marcar los ${candidatos.length}`}</button>
      </div>
      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {candidatos.map((p) => {
          const otro = p.qrId && p.qrId !== qr?.id ? db.qrs.find((x) => x.id === p.qrId) : null;
          return (
            <label key={p.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${seleccion.has(p.id) ? "bg-purple-50" : "hover:bg-slate-50"}`}>
              <input type="checkbox" className="w-4 h-4 accent-purple-700" checked={seleccion.has(p.id)} onChange={() => alternar(p.id)} />
              <div className="w-10 h-8 rounded overflow-hidden vx-photo shrink-0"><ProductPhoto p={p} /></div>
              <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.codigo} · {p.marca} {p.modelo}</div><div className="text-xs text-slate-500 truncate">Talla {p.talla} · {p.estado}{otro ? ` · ahora tiene ${otro.nombre}` : ""}</div></div>
              <span className={`text-sm vx-num font-semibold ${monto && Number(p.precio) !== Number(monto) ? "text-amber-600" : ""}`}>{bs0(p.precio)}</span>
            </label>
          );
        })}
        {!candidatos.length && <p className="px-3 py-6 text-sm text-slate-500 text-center">{soloPrecio && monto ? `No hay pares disponibles de ${bs0(monto)}. Quita el filtro de precio para ver todos.` : "No hay pares que coincidan."}</p>}
      </div>
      <p className="text-xs text-slate-500">{seleccion.size} par{seleccion.size === 1 ? "" : "es"} marcado{seleccion.size === 1 ? "" : "s"}. Los precios en naranja no coinciden con el monto del QR.</p>
    </div>
  );
}

/** Administrador de QR: lista, subir nuevo, editar, asignar a varios y eliminar */
export function QrManagerModal({ db, actions, onClose, toast }) {
  const [ver, setVer] = useState(null);
  const [modo, setModo] = useState(db.qrs.length ? "lista" : "nuevo");
  const [montoNuevo, setMontoNuevo] = useState("");
  const hayLibre = db.qrs.some((q) => q.monto == null);
  // Totales de pedidos de varios pares que hoy no tienen un QR con ese monto
  const totalesSinQr = useMemo(() => {
    if (hayLibre) return [];
    const g = new Map();
    db.reservations.filter((r) => r.web && r.estado === "Por pagar").forEach((r) => {
      const p = db.products.find((x) => x.id === r.productId);
      if (!p || p.estado !== "Disponible") return;
      const a = g.get(r.pedidoWeb) || { n: 0, total: 0 };
      g.set(r.pedidoWeb, { n: a.n + 1, total: a.total + Number(p.precio) });
    });
    const montos = new Set(db.qrs.map((q) => Number(q.monto)));
    return [...new Set([...g.values()].filter((x) => x.n > 1 && !montos.has(x.total)).map((x) => x.total))].sort((a, b) => a - b);
  }, [db.reservations, db.products, db.qrs, hayLibre]);
  const [editar, setEditar] = useState(null); // { qr, nombre, monto }
  const [asignar, setAsignar] = useState(null); // qr
  const [seleccion, setSeleccion] = useState(new Set());
  const [busy, run] = useBusy();

  const abrirAsignar = (qr) => {
    const actuales = usos(db, qr).map((p) => p.id);
    setSeleccion(new Set(actuales));
    setAsignar(qr);
  };

  if (ver) return <QrViewModal db={db} qrId={ver} toast={toast} onClose={() => setVer(null)} />;
  if (asignar) {
    const qr = db.qrs.find((x) => x.id === asignar.id) || asignar;
    return (
      <Modal wide title={`Pares que usan “${qr.nombre}”`} onClose={onClose} footer={<>
        <Btn variant="ghost" onClick={() => setAsignar(null)}>Volver</Btn>
        <Btn disabled={busy} onClick={() => run(async () => { if (await actions.assignQR(qr.id, [...seleccion], true)) setAsignar(null); })}>{busy ? <Spinner /> : <CheckCircle2 size={15} />} Guardar ({seleccion.size})</Btn>
      </>}>
        <div className="flex items-center gap-3">
          <img src={qr.url} alt="" className="w-16 h-16 object-contain rounded border border-slate-200 bg-white" />
          <div><div className="text-sm font-semibold">{qr.nombre}</div><div className="text-xs text-slate-500">{montoTxt(qr)} · marca todos los pares que se pagan con este QR</div></div>
        </div>
        <ElegirPares db={db} qr={qr} monto={qr.monto} seleccion={seleccion} setSeleccion={setSeleccion} />
      </Modal>
    );
  }

  return (
    <Modal wide title="QR de pago" onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>Cerrar</Btn>}>
      <p className="text-sm text-slate-600">Sube el QR de tu banco una vez: los pares de ese precio lo reciben solos, también los que agregues después. El cliente lo ve en “Mis pedidos” al comprar.</p>
      <Note>
        <b>Compras de varios pares:</b> la tienda muestra un QR por el <b>total</b> del pedido. Para eso sube aquí un <b>QR de monto libre</b> (sin monto: el cliente escribe el total en su banco) — es lo más práctico —, o QR con montos exactos de totales (ej.: Bs 360 para dos pares de 180).
        {!hayLibre && <span className="block mt-1">Todavía no tienes un QR de monto libre.</span>}
      </Note>
      {totalesSinQr.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-semibold text-amber-900">Clientes esperando pagar estos totales y no hay un QR para ellos:</div>
          <div className="flex flex-wrap gap-1.5 mt-2">{totalesSinQr.map((t) => <button key={t} onClick={() => { setMontoNuevo(String(t)); setModo("nuevo"); }} className="text-xs font-semibold rounded-full bg-white border border-amber-300 px-2.5 py-1 hover:bg-amber-100">Subir QR de {bs0(t)}</button>)}</div>
        </div>
      )}
      {modo === "nuevo" ? (
        <SubirVariosQr key={montoNuevo} db={db} actions={actions} montoInicial={montoNuevo} onCancel={() => { setModo("lista"); setMontoNuevo(""); }} onListo={() => { setModo("lista"); setMontoNuevo(""); }} toast={toast} />
      ) : (
        <div className="flex flex-col sm:flex-row gap-2"><Btn variant="outline" className="flex-1" onClick={() => { setMontoNuevo(""); setModo("nuevo"); }}><Plus size={15} /> Subir QR (uno o varios)</Btn></div>
      )}
      <div className="space-y-2">
        {db.qrs.map((q) => {
          const n = usos(db, q).length;
          const distintos = usos(db, q).filter((p) => q.monto && Number(p.precio) !== Number(q.monto)).length;
          return (
            <div key={q.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
              <button onClick={() => setVer(q.id)} className="w-16 h-16 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0" aria-label={`Ver ${q.nombre}`}><img src={q.url} alt="" className="w-full h-full object-contain" /></button>
              {editar?.qr.id === q.id ? (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input value={editar.nombre} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} aria-label="Nombre del QR" />
                  <Input type="number" inputMode="decimal" value={editar.monto} placeholder="Monto libre" onChange={(e) => setEditar({ ...editar, monto: e.target.value })} aria-label="Monto del QR" />
                  <div className="col-span-2 flex gap-2 justify-end">
                    <Btn size="sm" variant="ghost" onClick={() => setEditar(null)}>Cancelar</Btn>
                    <Btn size="sm" disabled={busy || (editar.monto !== "" && !(Number(editar.monto) > 0))} onClick={() => run(async () => { if (await actions.editQR(q, editar.nombre, editar.monto)) setEditar(null); })}>Guardar</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{q.nombre}</div>
                    <div className="text-xs text-slate-500">{montoTxt(q)} · {n} par{n === 1 ? "" : "es"}</div>
                    {distintos > 0 && <div className="text-xs text-amber-700 flex items-center gap-1 mt-0.5"><AlertTriangle size={12} /> {distintos} con otro precio</div>}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <Btn size="sm" onClick={() => abrirAsignar(q)}>Elegir pares</Btn>
                    <button className="p-2 rounded-md text-slate-500 hover:bg-slate-100" aria-label="Editar QR" onClick={() => setEditar({ qr: q, nombre: q.nombre, monto: q.monto == null ? "" : String(q.monto) })}><Pencil size={15} /></button>
                    <button className="p-2 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Eliminar QR" disabled={busy} onClick={() => { if (confirm(`¿Eliminar “${q.nombre}”? ${n ? `Los ${n} pares que lo usan quedarán sin QR.` : ""}`)) run(() => actions.deleteQR(q)); }}><Trash2 size={15} /></button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {!db.qrs.length && modo !== "nuevo" && <p className="text-sm text-slate-500 text-center py-6">Todavía no subiste ningún QR.</p>}
      </div>
    </Modal>
  );
}

/** Asignar un QR a uno o varios pares ya elegidos (desde la ficha o desde "Seleccionar varios") */
export function QrAssignModal({ db, ids, actions, onClose, onDone }) {
  const pares = ids.map((id) => db.products.find((p) => p.id === id)).filter(Boolean);
  const precios: number[] = [...new Set<number>(pares.map((p) => Number(p.precio)))];
  const sugerido = db.qrs.find((q) => precios.length === 1 && Number(q.monto) === precios[0]);
  const [elegido, setElegido] = useState(sugerido?.id || "");
  const [nuevo, setNuevo] = useState(!db.qrs.length);
  const [busy, run] = useBusy();
  const actual = pares.length === 1 ? pares[0].qrId : null;
  const terminar = () => { onDone && onDone(); onClose(); };
  return (
    <Modal wide title={pares.length === 1 ? `QR de pago · ${pares[0].codigo}` : `QR de pago para ${pares.length} pares`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      {actual && <Btn variant="danger" disabled={busy} onClick={() => run(async () => { if (await actions.assignQR(null, ids)) terminar(); })}><X size={15} /> Quitar QR</Btn>}
      {!nuevo && <Btn disabled={busy || !elegido} onClick={() => run(async () => { if (await actions.assignQR(elegido, ids)) terminar(); })}>{busy ? <Spinner /> : null} Asignar a {pares.length} par{pares.length === 1 ? "" : "es"}</Btn>}
    </>}>
      <div className="flex flex-wrap gap-1.5">
        {pares.slice(0, 12).map((p) => <span key={p.id} className="text-xs font-semibold bg-slate-100 rounded-md px-2 py-1">{p.codigo} · {bs0(p.precio)}</span>)}
        {pares.length > 12 && <span className="text-xs text-slate-500 self-center">y {pares.length - 12} más</span>}
      </div>
      {precios.length > 1 && <Note tone="rose">Elegiste pares con precios distintos ({precios.map((x) => bs0(x)).join(", ")}). Si tu QR tiene un monto fijo, solo sirve para los de ese precio.</Note>}
      {nuevo ? (
        <NuevoQr busy={busy} montoInicial={precios.length === 1 ? precios[0] : ""} onCancel={() => setNuevo(false)} onGuardar={({ file, monto, nombre }) => run(async () => {
          if (await actions.createQR(file, nombre, monto, ids)) terminar();
        })} />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="QR disponibles">
            {db.qrs.map((q) => (
              <button key={q.id} role="radio" aria-checked={elegido === q.id} onClick={() => setElegido(q.id)} className={`flex items-center gap-3 rounded-xl border p-2.5 text-left ${elegido === q.id ? "border-purple-700 ring-1 ring-purple-700 bg-purple-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <img src={q.url} alt="" className="w-14 h-14 object-contain rounded bg-white border border-slate-200" />
                <span className="min-w-0"><span className="block text-sm font-semibold truncate">{q.nombre}</span><span className="block text-xs text-slate-500">{montoTxt(q)}{q.id === actual ? " · actual" : ""}</span>
                  {q.monto && precios.some((x) => x !== Number(q.monto)) && <span className="block text-xs text-amber-700">No coincide con el precio</span>}
                </span>
              </button>
            ))}
          </div>
          <Btn variant="outline" className="w-full" onClick={() => setNuevo(true)}><Plus size={15} /> Subir un QR nuevo para {pares.length === 1 ? "este par" : "estos pares"}</Btn>
        </>
      )}
    </Modal>
  );
}

// Subir varios QR a la vez: cada uno se ve en grande para leer su monto y escribirlo
function SubirVariosQr({ db, actions, montoInicial = "", onCancel, onListo, toast }) {
  const [items, setItems] = useState([]); // { key, file, url, monto, nombre }
  const [ver, setVer] = useState(null);
  const [estado, setEstado] = useState("");
  const [busy, run] = useBusy();
  useEffect(() => () => items.forEach((x) => URL.revokeObjectURL(x.url)), []);
  const agregar = (fs) => setItems((a) => {
    const nuevos = fs.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, file: f, url: URL.createObjectURL(f), monto: a.length === 0 && i === 0 && montoInicial ? String(montoInicial) : "", nombre: "" }));
    return [...a, ...nuevos].slice(0, 12);
  });
  const cambiar = (k, campo, v) => setItems((a) => a.map((x) => (x.key === k ? { ...x, [campo]: v } : x)));
  const quitar = (k) => setItems((a) => { const x = a.find((y) => y.key === k); if (x) URL.revokeObjectURL(x.url); return a.filter((y) => y.key !== k); });
  const disponibles = (p) => p.estado === "Disponible" || p.estado === "Reservado";
  const qrDe = (id) => db.qrs.find((q) => q.id === id);
  // Pares que recibirán este QR: los de ese precio sin QR (o con uno de monto libre). Un QR libre: los que no tienen QR.
  const paresPara = (monto) => monto
    ? db.products.filter((p) => disponibles(p) && Number(p.precio) === Number(monto) && (!p.qrId || qrDe(p.qrId)?.monto == null))
    : db.products.filter((p) => disponibles(p) && !p.qrId);
  const mal = items.some((x) => x.monto !== "" && !(Number(x.monto) > 0));
  const repetidos = (m) => m !== "" && items.filter((x) => x.monto === m).length > 1;
  const guardar = () => run(async () => {
    let ok = 0, pares = 0;
    const asignados = new Set();
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      setEstado(`Guardando ${i + 1} de ${items.length}…`);
      const ids = paresPara(x.monto).map((p) => p.id).filter((id) => !asignados.has(id));
      const id = await actions.createQR(x.file, x.nombre, x.monto, ids, { silencioso: true });
      if (!id) break;
      ids.forEach((pid) => asignados.add(pid));
      ok++; pares += ids.length;
    }
    setEstado("");
    await actions.refrescar();
    if (ok) {
      toast(`${ok === 1 ? "QR guardado" : `${ok} QR guardados`}${pares ? ` y puestos en ${pares} par${pares === 1 ? "" : "es"} del mismo precio` : ""}.`);
      if (ok === items.length) onListo();
      else setItems((a) => a.slice(ok));
    }
  });
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">Subir QR {items.length ? `(${items.length})` : ""}</div>
        <span className="text-xs text-slate-500">Puedes elegir varios a la vez</span>
      </div>
      {!items.length && <p className="text-xs text-slate-600">Elige las imágenes de tus QR (capturas de la app del banco). Después verás cada una en grande para escribir su monto.</p>}
      <div className="flex gap-2"><PhotoPicker compact max={12} disabled={busy || items.length >= 12} onFiles={agregar} /></div>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((x, i) => {
          const n = paresPara(x.monto).length;
          const yaHay = x.monto && db.qrs.some((q) => Number(q.monto) === Number(x.monto));
          return (
            <div key={x.key} className="rounded-xl bg-white border border-slate-200 p-2.5 space-y-2">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">QR {i + 1}</span><button type="button" disabled={busy} onClick={() => quitar(x.key)} className="p-1 rounded text-slate-400 hover:text-rose-600" aria-label={`Quitar QR ${i + 1}`}><X size={16} /></button></div>
              <button type="button" onClick={() => setVer(x.url)} className="relative w-full h-56 rounded-lg bg-white border border-slate-100 overflow-hidden" aria-label={`Ver el QR ${i + 1} en grande`}>
                <img src={x.url} alt={`QR ${i + 1}`} className="w-full h-full object-contain" />
                <span className="absolute bottom-1.5 right-1.5 text-[11px] font-semibold bg-slate-900/75 text-white rounded px-1.5 py-0.5">Toca para ampliar</span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Monto (Bs)"><Input type="number" inputMode="decimal" value={x.monto} placeholder="Vacío = libre" onChange={(e) => cambiar(x.key, "monto", e.target.value)} /></Field>
                <Field label="Nombre (opcional)"><Input value={x.nombre} maxLength={60} placeholder={x.monto ? `QR Bs ${x.monto}` : "QR libre"} onChange={(e) => cambiar(x.key, "nombre", e.target.value)} /></Field>
              </div>
              <p className={`text-xs ${x.monto !== "" && !(Number(x.monto) > 0) ? "text-rose-600" : "text-slate-500"}`}>
                {x.monto !== "" && !(Number(x.monto) > 0) ? "Escribe un monto mayor a cero, o déjalo vacío si es de monto libre."
                  : x.monto ? `Se pondrá en ${n} par${n === 1 ? "" : "es"} de ${bs0(x.monto)}.` : `QR de monto libre: se pondrá en ${n} par${n === 1 ? "" : "es"} sin QR, y sirve para pagar totales.`}
                {yaHay ? " Ya tienes otro QR con ese monto." : ""}{repetidos(x.monto) ? " Hay otro QR con el mismo monto en esta lista." : ""}
              </p>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 items-center">
        {estado && <span className="text-xs text-slate-600 flex items-center gap-1.5 mr-auto"><Spinner /> {estado}</span>}
        <Btn variant="ghost" size="sm" disabled={busy} onClick={onCancel}>Cancelar</Btn>
        <Btn size="sm" disabled={busy || !items.length || mal} onClick={guardar}>{busy ? <Spinner /> : null} Guardar {items.length > 1 ? `los ${items.length} QR` : "QR"}</Btn>
      </div>
      {ver && <PhotoViewer urls={[ver]} title="QR" onClose={() => setVer(null)} />}
    </div>
  );
}
