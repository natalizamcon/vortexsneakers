import { useState } from "react";
import { LogOut, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase, mensajeError } from "../lib/supabase";
import { Logo, Isotipo, Btn, Field, Input, PasswordInput, Spinner } from "../components/ui";

export function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const entrar = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setErr(mensajeError(error));
  };
  return (
    <div className="vx min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white overflow-hidden">
        <div className="absolute -right-16 -bottom-10 w-96 h-96 opacity-90"><Isotipo className="w-full h-full" /></div>
        <div className="relative"><Logo dark size="lg" /></div>
        <div className="relative max-w-md">
          <h1 className="vx-d text-5xl font-extrabold leading-none">Cada par, con su historia y su número.</h1>
          <p className="mt-4 text-slate-300">Inventario, ventas, cobros y ganancias del negocio en un solo lugar.</p>
        </div>
        <div className="relative text-xs text-slate-400">Cochabamba, Bolivia</div>
      </div>
      <div className="flex items-center justify-center p-6 vx-safe-t">
        <form className="w-full max-w-sm" onSubmit={entrar}>
          <div className="lg:hidden mb-8"><Logo size="lg" /></div>
          <h2 className="vx-d text-2xl font-bold text-slate-900">Iniciar sesión</h2>
          <p className="text-sm text-slate-500 mt-1 mb-6">Entra con el correo y la contraseña que te dio el administrador.</p>
          <div className="space-y-4">
            <Field label="Correo"><Input type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Contraseña"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            {err && <p className="text-sm text-rose-600 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{err}</p>}
            <Btn type="submit" className="w-full py-2.5" disabled={busy || !email || !pw}>{busy ? <Spinner /> : null} Entrar</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }) {
  return (
    <div className="vx min-h-screen grid place-items-center bg-white">
      <div className="flex flex-col items-center gap-4 text-slate-500">
        <Isotipo className="w-16 h-16" />
        <span className="flex items-center gap-2 text-sm"><Spinner /> {texto}</span>
      </div>
    </div>
  );
}

export function SinConfigurar() {
  return (
    <div className="vx min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="max-w-lg bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <Logo />
        <h1 className="vx-d text-xl font-bold">Falta conectar la base de datos</h1>
        <p className="text-sm text-slate-600">Abre el archivo <code className="bg-slate-100 rounded px-1">src/config.ts</code> y pega los dos datos de tu proyecto de Supabase:</p>
        <ol className="text-sm text-slate-600 list-decimal pl-5 space-y-1">
          <li><b>SUPABASE_URL</b>: la “Project URL”.</li>
          <li><b>SUPABASE_KEY</b>: la “Publishable key” (o “anon public”).</li>
        </ol>
        <p className="text-sm text-slate-600">Los encuentras en Supabase → Project Settings → API. Guarda el archivo y Netlify publicará la app de nuevo.</p>
      </div>
    </div>
  );
}

export function SinAcceso({ email, motivo = "" }) {
  return (
    <div className="vx min-h-screen grid place-items-center bg-slate-50 p-6">
      <div className="max-w-md bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-center">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="vx-d text-xl font-bold">{motivo ? "No se pudieron cargar los datos" : "Tu usuario todavía no tiene acceso"}</h1>
        <p className="text-sm text-slate-600">
          {motivo || <>La cuenta <b>{email}</b> existe, pero un administrador debe habilitarla. Si eres el primer administrador, ejecuta el archivo <code className="bg-slate-100 rounded px-1">02_administrador.sql</code> en Supabase con este mismo correo.</>}
        </p>
        <div className="flex justify-center gap-2">
          <Btn variant="outline" onClick={() => window.location.reload()}><RefreshCw size={15} /> Reintentar</Btn>
          <Btn variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut size={15} /> Cerrar sesión</Btn>
        </div>
      </div>
    </div>
  );
}
