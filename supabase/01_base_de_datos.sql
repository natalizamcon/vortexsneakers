-- =====================================================================
--  VORTEX SNEAKERS · Base de datos completa para Supabase
--  ---------------------------------------------------------------------
--  CÓMO USARLO:
--  1. En Supabase abre "SQL Editor" → "New query".
--  2. Copia TODO este archivo, pégalo y presiona "Run".
--  3. Debe terminar con "Success. No rows returned".
--  Puedes ejecutarlo otra vez sin perder datos (no borra nada).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Fecha de hoy en Bolivia (Supabase trabaja en hora UTC)
create or replace function public.hoy() returns date
language sql stable as $$ select (now() at time zone 'America/La_Paz')::date $$;

-- Arma códigos como V001, RES-001 o VTA-0001 sin cortar números grandes (V1000, V1001...)
create or replace function public._codigo(p_prefijo text, p_num bigint, p_ancho int) returns text
language sql immutable as $$
  select p_prefijo || case when length(p_num::text) >= p_ancho then p_num::text else lpad(p_num::text, p_ancho, '0') end
$$;

-- =====================================================================
--  TABLAS
-- =====================================================================

-- Usuarios del sistema (uno por cada cuenta de acceso)
create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '',
  email      text not null default '',
  rol        text not null default 'vendedor' check (rol in ('admin','vendedor','inventario')),
  activo     boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- Configuración general (una sola fila)
create table if not exists public.configuracion (
  id                 int primary key default 1 check (id = 1),
  canales            text[] not null default array['Facebook Live','Publicación Facebook','Instagram','TikTok','WhatsApp','Tienda física','App VORTEX'],
  metodos            text[] not null default array['Efectivo','QR','Transferencia','Tarjeta'],
  destinos           text[] not null default array['La Paz','Santa Cruz','Oruro','Potosí','Chuquisaca (Sucre)','Tarija','Beni (Trinidad)','Pando (Cobija)','Cochabamba (provincias)'],
  vigencia_horas     int not null default 48,
  dias_baja_rotacion int not null default 30
);

create table if not exists public.proveedores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text not null default '',
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);

create sequence if not exists public.seq_lote;
create sequence if not exists public.seq_producto;
create sequence if not exists public.seq_reserva;
create sequence if not exists public.seq_venta;

-- Lotes o fardos comprados
create table if not exists public.lotes (
  id               text primary key,                 -- L001, L002...
  nombre           text not null,
  proveedor_id     uuid references public.proveedores(id),
  fecha            date not null default public.hoy(),
  origen           text not null default 'Mixto',
  pares            int  not null check (pares > 0),
  costo_compra     numeric(12,2) not null default 0 check (costo_compra >= 0),
  costo_transporte numeric(12,2) not null default 0 check (costo_transporte >= 0),
  otros_gastos     numeric(12,2) not null default 0 check (otros_gastos >= 0),
  obs              text not null default '',
  creado_por       uuid default auth.uid(),
  creado_en        timestamptz not null default now()
);

-- Cada par de tenis es un producto individual
create table if not exists public.productos (
  id               uuid primary key default gen_random_uuid(),
  codigo           text unique not null,             -- V001, V002...
  lote_id          text not null references public.lotes(id),
  marca            text not null,
  modelo           text not null default '',
  origen           text not null check (origen in ('Americano','Coreano')),
  categoria        text not null default 'Unisex',
  talla            numeric(4,1) not null,
  color            text not null default '',
  estado_fisico    text not null default 'Excelente',
  descripcion      text not null default '',
  obs              text not null default '',
  costo_compra     numeric(12,4) not null default 0,  -- se calcula solo desde el lote
  costo_transporte numeric(12,4) not null default 0,  -- transporte + otros gastos del lote
  precio           numeric(12,2) not null check (precio >= 0),
  estado           text not null default 'Disponible' check (estado in ('Disponible','Reservado','Vendido')),
  fecha_ingreso    date not null default public.hoy(),
  creado_por       uuid default auth.uid(),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index if not exists productos_estado_idx on public.productos(estado);
create index if not exists productos_lote_idx on public.productos(lote_id);

-- Pares eliminados (dados de baja): salen del inventario pero conservan su historial
alter table public.productos add column if not exists baja_motivo text not null default '';
alter table public.productos add column if not exists baja_en     timestamptz;
alter table public.productos add column if not exists baja_por    uuid;
alter table public.productos drop constraint if exists productos_estado_check;
alter table public.productos add constraint productos_estado_check
  check (estado in ('Disponible','Reservado','Vendido','Eliminado'));
-- Largo de la zapatilla en centímetros (opcional)
alter table public.productos add column if not exists cm numeric(4,1);
alter table public.productos drop constraint if exists productos_cm_check;
alter table public.productos add constraint productos_cm_check check (cm is null or (cm > 0 and cm < 100));

create table if not exists public.producto_fotos (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  ruta        text not null,
  orden       int not null default 0,
  creado_en   timestamptz not null default now()
);
create index if not exists fotos_producto_idx on public.producto_fotos(producto_id);

create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text not null,
  zona       text not null default '',
  direccion  text not null default '',
  obs        text not null default '',
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);
create unique index if not exists clientes_telefono_uq on public.clientes(telefono);

create table if not exists public.ventas (
  id         text primary key,                       -- VTA-0001...
  fecha      date not null default public.hoy(),
  cliente_id uuid not null references public.clientes(id),
  canal      text not null default '',
  estado     text not null default 'Activa' check (estado in ('Activa','Anulada')),
  motivo     text not null default '',
  obs        text not null default '',
  entrega    jsonb not null default '{}'::jsonb,     -- tipo, costo, destino, fecha de envío...
  pedido     text not null default 'Pendiente de preparación'
             check (pedido in ('Pendiente de preparación','Preparando','Listo para entregar','Enviado','Entregado')),
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);

create table if not exists public.reservas (
  id          text primary key,                      -- RES-001...
  producto_id uuid not null references public.productos(id),
  cliente_id  uuid not null references public.clientes(id),
  canal       text not null default '',
  vence       timestamptz not null,
  adelanto    numeric(12,2) not null default 0,
  estado      text not null default 'Activa' check (estado in ('Activa','Cancelada','Convertida')),
  envio       jsonb not null default '{}'::jsonb,
  obs         text not null default '',
  venta_id    text references public.ventas(id),
  creado_por  uuid default auth.uid(),
  creado_en   timestamptz not null default now()
);
-- Un par solo puede tener UNA reserva activa
create unique index if not exists reservas_una_activa on public.reservas(producto_id) where estado = 'Activa';

create table if not exists public.venta_items (
  id          uuid primary key default gen_random_uuid(),
  venta_id    text not null references public.ventas(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  precio      numeric(12,2) not null check (precio >= 0),
  costo       numeric(12,4) not null default 0,      -- costo real congelado al vender
  activo      boolean not null default true
);
-- Un par solo puede estar en UNA venta activa (evita ventas duplicadas)
create unique index if not exists venta_items_un_par on public.venta_items(producto_id) where activo;
create index if not exists venta_items_venta_idx on public.venta_items(venta_id);
-- Regalos: la venta se cierra en 0; se guarda el precio de lista para saber cuánto se regaló
alter table public.ventas add column if not exists regalo boolean not null default false;
alter table public.venta_items add column if not exists precio_lista numeric(12,2);

create table if not exists public.pagos (
  id         uuid primary key default gen_random_uuid(),
  venta_id   text references public.ventas(id),
  reserva_id text references public.reservas(id),
  fecha      date not null default public.hoy(),
  monto      numeric(12,2) not null check (monto > 0),
  metodo     text not null default 'Efectivo',
  anulado    boolean not null default false,
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);
create index if not exists pagos_venta_idx on public.pagos(venta_id);
create index if not exists pagos_reserva_idx on public.pagos(reserva_id);

create table if not exists public.gastos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null default public.hoy(),
  concepto   text not null,
  categoria  text not null default 'Otros gastos',
  monto      numeric(12,2) not null check (monto > 0),
  metodo     text not null default 'Efectivo',
  obs        text not null default '',
  venta_id   text references public.ventas(id),
  anulado    boolean not null default false,
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);

create table if not exists public.otros_ingresos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null default public.hoy(),
  concepto   text not null,
  monto      numeric(12,2) not null check (monto > 0),
  metodo     text not null default 'Efectivo',
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);

create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  tipo         text not null default 'Otro',
  fecha        date not null,
  hora         time not null default '09:00',
  recordatorio int  not null default 0,               -- minutos antes
  notas        text not null default '',
  hecho        boolean not null default false,
  creado_por   uuid default auth.uid(),
  creado_en    timestamptz not null default now()
);
create index if not exists eventos_fecha_idx on public.eventos(fecha);

create table if not exists public.auditoria (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  usuario  uuid,
  accion   text not null,
  entidad  text not null default '',
  detalle  text not null default ''
);

-- =====================================================================
--  FUNCIONES DE APOYO (permisos y auditoría)
-- =====================================================================

create or replace function public.es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo)
$$;

create or replace function public.tiene_rol(p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo and rol = any(p_roles))
$$;

create or replace function public._exigir(p_roles text[]) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null or not exists (select 1 from public.perfiles where id = v and activo and rol = any(p_roles)) then
    raise exception 'No tienes permiso para esta acción.';
  end if;
  return v;
end $$;

create or replace function public._audit(p_user uuid, p_accion text, p_entidad text, p_detalle text) returns void
language sql security definer set search_path = public as $$
  insert into public.auditoria(usuario, accion, entidad, detalle)
  values (p_user, p_accion, coalesce(p_entidad, ''), coalesce(p_detalle, ''));
$$;
revoke execute on function public._audit(uuid, text, text, text) from public, anon, authenticated;

-- Registro de actividad que usa la aplicación para acciones simples
create or replace function public.auditar(p_accion text, p_entidad text, p_detalle text) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid := public._exigir(array['admin','vendedor','inventario']);
begin
  perform public._audit(v, p_accion, p_entidad, p_detalle);
end $$;

-- Cada cuenta nueva recibe un perfil SIN acceso hasta que un administrador la habilite
create or replace function public._nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles(id, nombre, email, rol, activo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(coalesce(new.email,''), '@', 1)), coalesce(new.email, ''), 'vendedor', false)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists vortex_nuevo_usuario on auth.users;
create trigger vortex_nuevo_usuario after insert on auth.users
for each row execute function public._nuevo_usuario();

-- Productos: código automático, costo real desde el lote y estado protegido
create or replace function public._producto_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  l record;
  interno boolean := coalesce(current_setting('vortex.interno', true), '') = 'si';
begin
  if tg_op = 'INSERT' then
    if new.codigo is null or new.codigo = '' then
      new.codigo := public._codigo('V', nextval('public.seq_producto'), 3);
    end if;
    select * into l from public.lotes where id = new.lote_id;
    if not found then raise exception 'Elige un lote válido.'; end if;
    new.costo_compra     := round(l.costo_compra / l.pares, 4);
    new.costo_transporte := round((l.costo_transporte + l.otros_gastos) / l.pares, 4);
    new.estado     := 'Disponible';
    new.creado_por := coalesce(new.creado_por, auth.uid());
    return new;
  end if;

  new.codigo := old.codigo;
  if new.estado is distinct from old.estado and not interno then
    raise exception 'El estado del par solo cambia al reservar, vender, cancelar o anular.';
  end if;
  if not interno then
    if new.lote_id is distinct from old.lote_id and old.estado <> 'Vendido' then
      select * into l from public.lotes where id = new.lote_id;
      if not found then raise exception 'Elige un lote válido.'; end if;
      new.costo_compra     := round(l.costo_compra / l.pares, 4);
      new.costo_transporte := round((l.costo_transporte + l.otros_gastos) / l.pares, 4);
    else
      new.lote_id          := old.lote_id;
      new.costo_compra     := old.costo_compra;
      new.costo_transporte := old.costo_transporte;
    end if;
  end if;
  new.actualizado_en := now();
  return new;
end $$;
drop trigger if exists vortex_producto_antes on public.productos;
create trigger vortex_producto_antes before insert or update on public.productos
for each row execute function public._producto_antes();

-- =====================================================================
--  OPERACIONES DEL NEGOCIO (todo o nada: no quedan datos a medias)
-- =====================================================================

-- Reservar un par (bloquea el par para que nadie más lo tome)
create or replace function public.reservar_par(
  p_producto uuid, p_cliente uuid, p_canal text, p_horas int,
  p_adelanto numeric, p_metodo text, p_envio jsonb, p_obs text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  p record;
  v_id text;
begin
  if p_cliente is null then raise exception 'Elige un cliente.'; end if;
  select * into p from public.productos where id = p_producto for update;
  if not found then raise exception 'El par no existe.'; end if;
  if p.estado <> 'Disponible' then
    raise exception '% ya no está disponible: está %. No se registró la reserva.', p.codigo, lower(p.estado);
  end if;
  if coalesce(p_adelanto, 0) < 0 then raise exception 'El adelanto no puede ser negativo.'; end if;

  v_id := public._codigo('RES-', nextval('public.seq_reserva'), 3);
  insert into public.reservas(id, producto_id, cliente_id, canal, vence, adelanto, estado, envio, obs, creado_por)
  values (v_id, p_producto, p_cliente, coalesce(p_canal, ''), now() + make_interval(hours => greatest(coalesce(p_horas, 48), 1)),
          coalesce(p_adelanto, 0), 'Activa', coalesce(p_envio, '{}'::jsonb), coalesce(p_obs, ''), v);

  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Reservado' where id = p_producto;

  if coalesce(p_adelanto, 0) > 0 then
    insert into public.pagos(reserva_id, fecha, monto, metodo, creado_por)
    values (v_id, public.hoy(), p_adelanto, coalesce(p_metodo, 'Efectivo'), v);
  end if;

  perform public._audit(v, 'Reservó par', p.codigo,
    format('%s por %s h%s', v_id, coalesce(p_horas, 48), case when coalesce(p_adelanto,0) > 0 then format(' con adelanto Bs %s', p_adelanto) else '' end));
  return v_id;
end $$;

-- Cancelar una reserva: el par vuelve a disponibles
create or replace function public.cancelar_reserva(p_reserva text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  r record;
  v_cod text;
begin
  select * into r from public.reservas where id = p_reserva for update;
  if not found then raise exception 'La reserva no existe.'; end if;
  if r.estado <> 'Activa' then raise exception 'La reserva ya no está activa.'; end if;

  update public.reservas
     set estado = 'Cancelada', obs = case when coalesce(p_motivo, '') = '' then obs else p_motivo end
   where id = p_reserva;

  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Disponible' where id = r.producto_id and estado = 'Reservado'
  returning codigo into v_cod;
  update public.pagos set anulado = true where reserva_id = p_reserva and venta_id is null;

  perform public._audit(v, 'Canceló reserva', p_reserva,
    format('%s vuelve a disponible%s', coalesce(v_cod, ''), case when r.adelanto > 0 then '; adelanto marcado como devuelto' else '' end));
end $$;

-- Registrar una venta (o un regalo). Bloquea los pares para que nadie más los venda al mismo tiempo.
--  • p_regalo: el par se entrega sin cobrar (total 0, sin saldo pendiente). El adelanto de una
--    reserva, si lo había, queda como devuelto.
--  • p_entregado: la venta ya se entregó en el momento (por ejemplo, en la tienda).
drop function if exists public.registrar_venta(uuid, text, jsonb, text[], numeric, text, jsonb, text);
create or replace function public.registrar_venta(
  p_cliente uuid, p_canal text, p_items jsonb, p_reservas text[],
  p_pago numeric, p_metodo text, p_entrega jsonb, p_obs text,
  p_regalo boolean default false, p_entregado boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  v_id text;
  it record;
  p record;
  v_total numeric;
  v_pagado numeric;
  v_regalo boolean := coalesce(p_regalo, false);
  v_costo_envio numeric := coalesce(nullif(p_entrega->>'costo', '')::numeric, 0);
begin
  if p_cliente is null then raise exception 'Elige un cliente.'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un par a la venta.'; end if;
  if v_regalo and coalesce(p_pago, 0) > 0 then raise exception 'Un regalo no lleva pago.'; end if;

  for it in select * from jsonb_to_recordset(p_items) as x(producto_id uuid, precio numeric) loop
    select * into p from public.productos where id = it.producto_id for update;
    if not found then raise exception 'Uno de los pares no existe.'; end if;
    if p.estado = 'Vendido' then raise exception '% ya fue vendido. Revisa la venta.', p.codigo; end if;
    if p.estado = 'Eliminado' then raise exception '% fue eliminado del inventario.', p.codigo; end if;
    if p.estado = 'Reservado' and not exists (
      select 1 from public.reservas where producto_id = p.id and estado = 'Activa' and id = any(coalesce(p_reservas, '{}'::text[]))
    ) then
      raise exception '% está reservado para otro cliente.', p.codigo;
    end if;
    if not v_regalo and (it.precio is null or it.precio < 0) then raise exception 'Revisa el precio de %.', p.codigo; end if;
  end loop;

  v_id := public._codigo('VTA-', nextval('public.seq_venta'), 4);
  insert into public.ventas(id, fecha, cliente_id, canal, estado, obs, entrega, pedido, regalo, creado_por)
  values (v_id, public.hoy(), p_cliente, coalesce(p_canal, ''), 'Activa', coalesce(p_obs, ''), coalesce(p_entrega, '{}'::jsonb),
          case when coalesce(p_entregado, false) then 'Entregado' else 'Pendiente de preparación' end, v_regalo, v);

  insert into public.venta_items(venta_id, producto_id, precio, costo, precio_lista)
  select v_id, x.producto_id, case when v_regalo then 0 else x.precio end, pr.costo_compra + pr.costo_transporte, pr.precio
    from jsonb_to_recordset(p_items) as x(producto_id uuid, precio numeric)
    join public.productos pr on pr.id = x.producto_id;

  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Vendido'
   where id in (select (e->>'producto_id')::uuid from jsonb_array_elements(p_items) e);

  update public.reservas set estado = 'Convertida', venta_id = v_id
   where id = any(coalesce(p_reservas, '{}'::text[])) and estado = 'Activa';
  -- El adelanto de la reserva pasa a la venta (no se cuenta dos veces). Si es regalo, queda devuelto.
  update public.pagos set venta_id = v_id, anulado = v_regalo
   where reserva_id = any(coalesce(p_reservas, '{}'::text[])) and not anulado and venta_id is null;

  select coalesce(sum(precio), 0) into v_total from public.venta_items where venta_id = v_id;
  select coalesce(sum(monto), 0) into v_pagado from public.pagos where venta_id = v_id and not anulado;
  if coalesce(p_pago, 0) > 0 then
    if v_pagado + p_pago > v_total + 0.001 then
      raise exception 'El pago (Bs %) supera el saldo de la venta (Bs %).', p_pago, v_total - v_pagado;
    end if;
    insert into public.pagos(venta_id, fecha, monto, metodo, creado_por)
    values (v_id, public.hoy(), p_pago, coalesce(p_metodo, 'Efectivo'), v);
  end if;

  -- Si el negocio paga el envío, se registra como gasto de delivery
  if v_costo_envio > 0 and coalesce((p_entrega->>'pagaCliente')::boolean, false) = false
     and coalesce(p_entrega->>'tipo', '') <> 'Recojo en punto' then
    insert into public.gastos(fecha, concepto, categoria, monto, metodo, venta_id, creado_por)
    values (public.hoy(), 'Envío de ' || v_id, 'Delivery', v_costo_envio, 'Efectivo', v_id, v);
  end if;

  perform public._audit(v, case when v_regalo then 'Registró regalo' else 'Registró venta' end, v_id,
    format('%s par(es) — Bs %s — %s%s', jsonb_array_length(p_items), v_total, coalesce(p_canal, ''),
           case when coalesce(p_entregado, false) then ' — entregado en el momento' else '' end));
  return v_id;
end $$;

-- Modificar una venta ya registrada (solo administradores):
-- marcarla o desmarcarla como regalo, corregir precios, canal y estado de la entrega.
create or replace function public.editar_venta(p_venta text, p_regalo boolean, p_precios jsonb, p_canal text, p_pedido text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin']);
  etapas text[] := array['Pendiente de preparación','Preparando','Listo para entregar','Enviado','Entregado'];
  s record;
  it record;
  v_regalo boolean := coalesce(p_regalo, false);
  v_total numeric;
  v_pagado numeric;
  v_devuelto numeric := 0;
  v_antes numeric;
  v_cambios text[] := '{}';
begin
  select * into s from public.ventas where id = p_venta for update;
  if not found then raise exception 'La venta no existe.'; end if;
  if s.estado <> 'Activa' then raise exception 'La venta está anulada; no se puede modificar.'; end if;
  select coalesce(sum(precio), 0) into v_antes from public.venta_items where venta_id = p_venta and activo;
  if p_pedido is not null and not (p_pedido = any(etapas)) then raise exception 'Estado de entrega no válido.'; end if;

  if v_regalo then
    update public.venta_items set precio = 0 where venta_id = p_venta and activo;
    select coalesce(sum(monto), 0) into v_devuelto from public.pagos where venta_id = p_venta and not anulado;
    update public.pagos set anulado = true where venta_id = p_venta and not anulado;
    if not s.regalo then v_cambios := array_append(v_cambios, 'marcada como regalo'); end if;
    if v_devuelto > 0 then v_cambios := array_append(v_cambios, format('pagos devueltos Bs %s', v_devuelto)); end if;
  else
    for it in select * from jsonb_to_recordset(coalesce(p_precios, '[]'::jsonb)) as x(id uuid, precio numeric) loop
      if it.precio is null or it.precio < 0 then raise exception 'Revisa los precios: no pueden ser negativos.'; end if;
      update public.venta_items set precio = it.precio where id = it.id and venta_id = p_venta and activo;
    end loop;
    select coalesce(sum(precio), 0) into v_total from public.venta_items where venta_id = p_venta and activo;
    select coalesce(sum(monto), 0) into v_pagado from public.pagos where venta_id = p_venta and not anulado;
    if v_pagado > v_total + 0.001 then
      raise exception 'El total (Bs %) quedaría por debajo de lo ya cobrado (Bs %).', v_total, v_pagado;
    end if;
    if s.regalo then v_cambios := array_append(v_cambios, 'ya no es regalo'); end if;
    if v_total <> v_antes then v_cambios := array_append(v_cambios, format('total Bs %s → Bs %s', v_antes, v_total)); end if;
  end if;

  if coalesce(nullif(trim(p_canal), ''), s.canal) <> s.canal then
    v_cambios := array_append(v_cambios, 'canal: ' || s.canal || ' → ' || trim(p_canal));
  end if;
  if p_pedido is not null and p_pedido <> s.pedido then
    v_cambios := array_append(v_cambios, 'entrega: ' || s.pedido || ' → ' || p_pedido);
  end if;

  update public.ventas
     set regalo = v_regalo,
         canal  = coalesce(nullif(trim(p_canal), ''), canal),
         pedido = coalesce(p_pedido, pedido)
   where id = p_venta;

  perform public._audit(v, 'Modificó venta', p_venta, coalesce(nullif(array_to_string(v_cambios, '; '), ''), 'Sin cambios'));
  return jsonb_build_object('devuelto', v_devuelto);
end $$;

-- Registrar un pago (total o parcial)
create or replace function public.registrar_pago(p_venta text, p_monto numeric, p_metodo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  s record;
  v_total numeric;
  v_pagado numeric;
begin
  select * into s from public.ventas where id = p_venta for update;
  if not found then raise exception 'La venta no existe.'; end if;
  if s.estado <> 'Activa' then raise exception 'La venta está anulada.'; end if;
  select coalesce(sum(precio), 0) into v_total from public.venta_items where venta_id = p_venta;
  select coalesce(sum(monto), 0) into v_pagado from public.pagos where venta_id = p_venta and not anulado;
  if coalesce(p_monto, 0) <= 0 then raise exception 'El monto debe ser mayor a 0.'; end if;
  if p_monto > (v_total - v_pagado) + 0.001 then
    raise exception 'El monto supera el saldo pendiente (Bs %).', v_total - v_pagado;
  end if;
  insert into public.pagos(venta_id, fecha, monto, metodo, creado_por)
  values (p_venta, public.hoy(), p_monto, coalesce(p_metodo, 'Efectivo'), v);
  perform public._audit(v, 'Registró pago', p_venta, format('Bs %s con %s', p_monto, p_metodo));
end $$;

-- Anular una venta: no se borra, los pares vuelven y los pagos quedan como reembolsados
create or replace function public.anular_venta(p_venta text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin']);
  s record;
begin
  if length(coalesce(trim(p_motivo), '')) < 4 then raise exception 'Escribe el motivo de la anulación.'; end if;
  select * into s from public.ventas where id = p_venta for update;
  if not found then raise exception 'La venta no existe.'; end if;
  if s.estado <> 'Activa' then raise exception 'La venta ya estaba anulada.'; end if;

  update public.ventas set estado = 'Anulada', motivo = p_motivo where id = p_venta;
  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Disponible'
   where id in (select producto_id from public.venta_items where venta_id = p_venta and activo);
  update public.venta_items set activo = false where venta_id = p_venta;
  update public.pagos set anulado = true where venta_id = p_venta;
  update public.gastos set anulado = true where venta_id = p_venta;
  perform public._audit(v, 'Anuló venta', p_venta, p_motivo);
end $$;

-- Avanzar el pedido a la siguiente etapa
create or replace function public.avanzar_pedido(p_venta text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor','inventario']);
  etapas text[] := array['Pendiente de preparación','Preparando','Listo para entregar','Enviado','Entregado'];
  s record;
  i int;
begin
  select * into s from public.ventas where id = p_venta for update;
  if not found then raise exception 'El pedido no existe.'; end if;
  if s.estado <> 'Activa' then raise exception 'La venta está anulada.'; end if;
  i := array_position(etapas, s.pedido);
  if i is null or i >= array_length(etapas, 1) then raise exception 'El pedido ya fue entregado.'; end if;
  update public.ventas set pedido = etapas[i + 1] where id = p_venta;
  perform public._audit(v, 'Actualizó pedido', p_venta, s.pedido || ' → ' || etapas[i + 1]);
  return etapas[i + 1];
end $$;

-- Crear o editar un lote (con proveedor nuevo o existente)
create or replace function public.guardar_lote(
  p_id text, p_nombre text, p_fecha date, p_origen text, p_pares int,
  p_compra numeric, p_transporte numeric, p_otros numeric, p_obs text,
  p_proveedor_id uuid, p_prov_nombre text, p_prov_telefono text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','inventario']);
  v_prov uuid := p_proveedor_id;
  v_id text := nullif(trim(coalesce(p_id, '')), '');
  v_registrados int;
  v_total numeric := coalesce(p_compra, 0) + coalesce(p_transporte, 0) + coalesce(p_otros, 0);
begin
  if coalesce(p_pares, 0) <= 0 then raise exception 'La cantidad de pares debe ser mayor a 0.'; end if;
  if coalesce(p_compra, 0) < 0 or coalesce(p_transporte, 0) < 0 or coalesce(p_otros, 0) < 0 then
    raise exception 'Los montos no pueden ser negativos.';
  end if;

  if v_prov is null then
    if coalesce(trim(p_prov_nombre), '') = '' then raise exception 'Escribe el nombre del proveedor.'; end if;
    if exists (select 1 from public.proveedores where lower(nombre) = lower(trim(p_prov_nombre))) then
      raise exception 'Ya existe un proveedor con ese nombre. Elígelo en "Ya trabajé con él".';
    end if;
    if coalesce(trim(p_prov_telefono), '') <> '' and exists (select 1 from public.proveedores where telefono = trim(p_prov_telefono)) then
      raise exception 'Ese número ya pertenece a otro proveedor.';
    end if;
    insert into public.proveedores(nombre, telefono, creado_por)
    values (trim(p_prov_nombre), coalesce(trim(p_prov_telefono), ''), v) returning id into v_prov;
  else
    update public.proveedores set telefono = coalesce(trim(p_prov_telefono), telefono) where id = v_prov;
    if not found then raise exception 'El proveedor elegido no existe.'; end if;
  end if;

  if v_id is null then
    v_id := public._codigo('L', nextval('public.seq_lote'), 3);
    insert into public.lotes(id, nombre, proveedor_id, fecha, origen, pares, costo_compra, costo_transporte, otros_gastos, obs, creado_por)
    values (v_id, coalesce(nullif(trim(p_nombre), ''), v_id), v_prov, coalesce(p_fecha, public.hoy()), coalesce(nullif(p_origen, ''), 'Mixto'),
            p_pares, coalesce(p_compra, 0), coalesce(p_transporte, 0), coalesce(p_otros, 0), coalesce(p_obs, ''), v);
    perform public._audit(v, 'Registró lote', v_id, format('%s — %s pares — Bs %s', p_nombre, p_pares, v_total));
  else
    select count(*) into v_registrados from public.productos where lote_id = v_id;
    if p_pares < v_registrados then
      raise exception 'Este lote ya tiene % pares cargados; la cantidad no puede ser menor.', v_registrados;
    end if;
    update public.lotes
       set nombre = coalesce(nullif(trim(p_nombre), ''), nombre), proveedor_id = v_prov, fecha = coalesce(p_fecha, fecha),
           origen = coalesce(nullif(p_origen, ''), origen), pares = p_pares, costo_compra = coalesce(p_compra, 0),
           costo_transporte = coalesce(p_transporte, 0), otros_gastos = coalesce(p_otros, 0), obs = coalesce(p_obs, '')
     where id = v_id;
    if not found then raise exception 'El lote no existe.'; end if;
    -- Recalcula el costo de los pares que todavía no se vendieron
    perform set_config('vortex.interno', 'si', true);
    update public.productos
       set costo_compra = round(coalesce(p_compra, 0) / p_pares, 4),
           costo_transporte = round((coalesce(p_transporte, 0) + coalesce(p_otros, 0)) / p_pares, 4)
     where lote_id = v_id and estado <> 'Vendido';
    perform public._audit(v, 'Editó lote', v_id, 'Costos recalculados para los pares no vendidos');
  end if;
  return v_id;
end $$;

-- Eliminar un par cargado por error (solo si nunca se reservó ni vendió)
create or replace function public.eliminar_producto(p_id uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin']);
  p record;
  v_rutas text[];
begin
  select * into p from public.productos where id = p_id for update;
  if not found then raise exception 'El par no existe.'; end if;
  if p.estado <> 'Disponible' then raise exception 'Solo se puede eliminar un par disponible.'; end if;
  if exists (select 1 from public.reservas where producto_id = p_id) or exists (select 1 from public.venta_items where producto_id = p_id) then
    raise exception 'Este par tiene reservas o ventas en su historial; no se puede eliminar.';
  end if;
  select coalesce(array_agg(ruta), '{}'::text[]) into v_rutas from public.producto_fotos where producto_id = p_id;
  delete from public.productos where id = p_id;
  perform public._audit(v, 'Eliminó par', p.codigo, p.marca || ' ' || p.modelo);
  return v_rutas;
end $$;

-- Eliminar uno o varios pares del inventario (solo administradores).
--  • "Cargado por error" y sin reservas ni ventas: se borra por completo (con sus fotos).
--  • En cualquier otro caso: se da de baja. Sale del inventario, conserva su historial
--    y su costo cuenta como pérdida. Se puede restaurar.
--  • Los pares reservados o vendidos no se tocan.
create or replace function public.eliminar_pares(p_ids uuid[], p_motivo text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin']);
  p record;
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'Otro');
  v_texto text;
  v_borrados int := 0;
  v_baja int := 0;
  v_omitidos text[] := '{}';
  v_rutas text[] := '{}';
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Elige al menos un par.'; end if;
  v_texto := v_motivo || case when coalesce(trim(p_nota), '') <> '' then ': ' || trim(p_nota) else '' end;
  perform set_config('vortex.interno', 'si', true);

  for p in select * from public.productos where id = any(p_ids) order by codigo for update loop
    if p.estado <> 'Disponible' then
      v_omitidos := array_append(v_omitidos, p.codigo);
      continue;
    end if;
    if v_motivo = 'Cargado por error'
       and not exists (select 1 from public.reservas where producto_id = p.id)
       and not exists (select 1 from public.venta_items where producto_id = p.id) then
      v_rutas := v_rutas || coalesce((select array_agg(ruta) from public.producto_fotos where producto_id = p.id), '{}'::text[]);
      delete from public.productos where id = p.id;
      v_borrados := v_borrados + 1;
      perform public._audit(v, 'Eliminó par', p.codigo, p.marca || ' ' || p.modelo || ' — ' || v_texto);
    else
      update public.productos
         set estado = 'Eliminado', baja_motivo = v_texto, baja_en = now(), baja_por = v
       where id = p.id;
      v_baja := v_baja + 1;
      perform public._audit(v, 'Dio de baja par', p.codigo, v_texto);
    end if;
  end loop;

  return jsonb_build_object('borrados', v_borrados, 'baja', v_baja,
                            'omitidos', to_jsonb(v_omitidos), 'rutas', to_jsonb(v_rutas));
end $$;

-- Devolver a disponibles un par dado de baja
create or replace function public.restaurar_par(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin']);
  p record;
begin
  select * into p from public.productos where id = p_id for update;
  if not found then raise exception 'El par no existe.'; end if;
  if p.estado <> 'Eliminado' then raise exception 'Ese par no está eliminado.'; end if;
  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Disponible', baja_motivo = '', baja_en = null, baja_por = null where id = p_id;
  perform public._audit(v, 'Restauró par', p.codigo, 'Volvió a disponibles');
end $$;

-- Ordenar las fotos de un par: la primera es la portada
create or replace function public.ordenar_fotos(p_producto uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','inventario']);
  v_cod text;
  i int;
begin
  select codigo into v_cod from public.productos where id = p_producto;
  if not found then raise exception 'El par no existe.'; end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.producto_fotos set orden = i - 1 where id = p_ids[i] and producto_id = p_producto;
  end loop;
  perform public._audit(v, 'Ordenó fotos', v_cod, 'Cambió la portada o el orden de las fotos');
end $$;

-- Agregar un destino de encomienda (lo pueden hacer administradores y vendedores)
create or replace function public.agregar_destino(p_nombre text)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._exigir(array['admin','vendedor']);
begin
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre del lugar.'; end if;
  update public.configuracion set destinos = array_append(destinos, trim(p_nombre))
   where id = 1 and not (trim(p_nombre) = any(destinos));
  perform public._audit(v, 'Agregó destino', trim(p_nombre), '');
end $$;

-- Libera las reservas vencidas SIN adelanto: el par vuelve solo a disponibles.
-- Las que tienen adelanto quedan marcadas como vencidas para que un socio decida.
create or replace function public.liberar_reservas_vencidas()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  if not public.es_activo() then return 0; end if;
  for r in select * from public.reservas
            where estado = 'Activa' and vence < now() and adelanto = 0
            for update skip locked loop
    update public.reservas
       set estado = 'Cancelada',
           obs = case when obs = '' then 'Venció sin confirmarse' else obs || ' (venció sin confirmarse)' end
     where id = r.id;
    perform set_config('vortex.interno', 'si', true);
    update public.productos set estado = 'Disponible' where id = r.producto_id and estado = 'Reservado';
    perform public._audit(null, 'Liberó reserva vencida', r.id, 'El par volvió a disponibles automáticamente');
    n := n + 1;
  end loop;
  return n;
end $$;

-- =====================================================================
--  USUARIOS (se crean desde la aplicación, sin volver a Supabase)
-- =====================================================================

create or replace function public.admin_crear_usuario(p_email text, p_password text, p_nombre text, p_rol text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid := public._exigir(array['admin']);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_new uuid := gen_random_uuid();
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres.'; end if;
  if p_rol not in ('admin','vendedor','inventario') then raise exception 'Rol no válido.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Ya existe un usuario con ese correo.'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_new, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nombre', trim(p_nombre)),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_new, v_new::text,
          jsonb_build_object('sub', v_new::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  insert into public.perfiles(id, nombre, email, rol, activo)
  values (v_new, coalesce(nullif(trim(p_nombre), ''), split_part(v_email, '@', 1)), v_email, p_rol, true)
  on conflict (id) do update set nombre = excluded.nombre, email = excluded.email, rol = excluded.rol, activo = true;

  perform public._audit(v, 'Creó usuario', v_email, p_rol);
  return v_new;
end $$;

create or replace function public.admin_actualizar_usuario(p_id uuid, p_nombre text, p_rol text, p_activo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._exigir(array['admin']);
begin
  if p_rol not in ('admin','vendedor','inventario') then raise exception 'Rol no válido.'; end if;
  if p_id = v and (p_rol <> 'admin' or not p_activo) then
    raise exception 'No puedes quitarte tu propio acceso de administrador.';
  end if;
  update public.perfiles set nombre = coalesce(nullif(trim(p_nombre), ''), nombre), rol = p_rol, activo = p_activo where id = p_id;
  if not found then raise exception 'El usuario no existe.'; end if;
  if not exists (select 1 from public.perfiles where rol = 'admin' and activo) then
    raise exception 'Debe quedar al menos un administrador activo.';
  end if;
  perform public._audit(v, 'Actualizó usuario', (select email from public.perfiles where id = p_id),
                        p_rol || case when p_activo then ' · activo' else ' · sin acceso' end);
end $$;

create or replace function public.admin_cambiar_password(p_id uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v uuid := public._exigir(array['admin']);
begin
  if length(coalesce(p_password, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  if not found then raise exception 'El usuario no existe.'; end if;
  perform public._audit(v, 'Cambió contraseña', (select email from public.perfiles where id = p_id), 'Por un administrador');
end $$;

-- =====================================================================
--  SEGURIDAD (Row Level Security): solo usuarios habilitados ven datos
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['perfiles','configuracion','proveedores','lotes','productos','producto_fotos','clientes',
                           'reservas','ventas','venta_items','pagos','gastos','otros_ingresos','eventos','auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Lectura para cualquier usuario habilitado
do $$
declare t text;
begin
  foreach t in array array['configuracion','proveedores','lotes','productos','producto_fotos','clientes',
                           'reservas','ventas','venta_items','pagos','eventos'] loop
    execute format('drop policy if exists vx_leer on public.%I', t);
    execute format('create policy vx_leer on public.%I for select to authenticated using (public.es_activo())', t);
  end loop;
end $$;

drop policy if exists vx_leer on public.perfiles;
create policy vx_leer on public.perfiles for select to authenticated using (id = auth.uid() or public.es_activo());

-- Configuración: solo administradores la cambian
drop policy if exists vx_editar on public.configuracion;
create policy vx_editar on public.configuracion for update to authenticated
  using (public.tiene_rol(array['admin'])) with check (public.tiene_rol(array['admin']));

-- Proveedores y lotes: administradores y encargados de inventario
drop policy if exists vx_editar on public.proveedores;
create policy vx_editar on public.proveedores for update to authenticated
  using (public.tiene_rol(array['admin','inventario'])) with check (public.tiene_rol(array['admin','inventario']));

-- Productos y fotos
drop policy if exists vx_crear on public.productos;
create policy vx_crear on public.productos for insert to authenticated with check (public.tiene_rol(array['admin','inventario']));
drop policy if exists vx_editar on public.productos;
create policy vx_editar on public.productos for update to authenticated
  using (public.tiene_rol(array['admin','inventario'])) with check (public.tiene_rol(array['admin','inventario']));
drop policy if exists vx_crear on public.producto_fotos;
create policy vx_crear on public.producto_fotos for insert to authenticated with check (public.tiene_rol(array['admin','inventario']));
drop policy if exists vx_borrar on public.producto_fotos;
create policy vx_borrar on public.producto_fotos for delete to authenticated using (public.tiene_rol(array['admin','inventario']));

-- Clientes: administradores y vendedores
drop policy if exists vx_crear on public.clientes;
create policy vx_crear on public.clientes for insert to authenticated with check (public.tiene_rol(array['admin','vendedor']));
drop policy if exists vx_editar on public.clientes;
create policy vx_editar on public.clientes for update to authenticated
  using (public.tiene_rol(array['admin','vendedor'])) with check (public.tiene_rol(array['admin','vendedor']));

-- Finanzas: solo administradores
do $$
declare t text;
begin
  foreach t in array array['gastos','otros_ingresos'] loop
    execute format('drop policy if exists vx_leer on public.%I', t);
    execute format('create policy vx_leer on public.%I for select to authenticated using (public.tiene_rol(array[''admin'']))', t);
    execute format('drop policy if exists vx_crear on public.%I', t);
    execute format('create policy vx_crear on public.%I for insert to authenticated with check (public.tiene_rol(array[''admin'']))', t);
    execute format('drop policy if exists vx_editar on public.%I', t);
    execute format('create policy vx_editar on public.%I for update to authenticated using (public.tiene_rol(array[''admin''])) with check (public.tiene_rol(array[''admin'']))', t);
  end loop;
end $$;

-- Agenda: todos los usuarios habilitados
drop policy if exists vx_crear on public.eventos;
create policy vx_crear on public.eventos for insert to authenticated with check (public.es_activo());
drop policy if exists vx_editar on public.eventos;
create policy vx_editar on public.eventos for update to authenticated using (public.es_activo()) with check (public.es_activo());
drop policy if exists vx_borrar on public.eventos;
create policy vx_borrar on public.eventos for delete to authenticated using (public.es_activo());

-- Actividad: solo administradores la ven; nadie la puede editar ni borrar
drop policy if exists vx_leer on public.auditoria;
create policy vx_leer on public.auditoria for select to authenticated using (public.tiene_rol(array['admin']));

-- Reservas, ventas y pagos solo se escriben con las operaciones de arriba (no hay permisos directos)

-- =====================================================================
--  DATOS INICIALES
-- =====================================================================
insert into public.configuracion (id) values (1) on conflict (id) do nothing;

-- Inversión inicial: 2 fardos de 40 pares (Bs 1.800 y Bs 1.900) + Bs 300 de envío
do $$
declare pv uuid;
begin
  if not exists (select 1 from public.lotes) then
    insert into public.proveedores(nombre, telefono) values ('Proveedor inicial', '') returning id into pv;
    insert into public.lotes(id, nombre, proveedor_id, origen, pares, costo_compra, costo_transporte, otros_gastos, obs)
    values (public._codigo('L', nextval('public.seq_lote'), 3), 'Fardo 1', pv, 'Mixto (≈50% americano / 50% coreano)', 40, 1800, 150, 0,
            'Inversión inicial. Transporte: mitad del envío total de Bs 300.');
    insert into public.lotes(id, nombre, proveedor_id, origen, pares, costo_compra, costo_transporte, otros_gastos, obs)
    values (public._codigo('L', nextval('public.seq_lote'), 3), 'Fardo 2', pv, 'Mayoría americano', 40, 1900, 150, 0,
            'Inversión inicial. Transporte: mitad del envío total de Bs 300.');
  end if;
end $$;

-- =====================================================================
--  FOTOS: carpeta de almacenamiento "productos" (pública para ver fotos)
--  Si tu proyecto no permite crearla aquí, el script sigue igual y
--  te avisará; en ese caso créala a mano (ver instrucciones).
-- =====================================================================
do $$
begin
  insert into storage.buckets (id, name, public) values ('productos', 'productos', true)
  on conflict (id) do update set public = true;
exception when others then
  raise notice 'No se pudo crear la carpeta de fotos automáticamente: %', sqlerrm;
end $$;

do $$
begin
  execute 'drop policy if exists "vortex fotos leer" on storage.objects';
  execute 'create policy "vortex fotos leer" on storage.objects for select using (bucket_id = ''productos'')';
  execute 'drop policy if exists "vortex fotos subir" on storage.objects';
  execute 'create policy "vortex fotos subir" on storage.objects for insert to authenticated with check (bucket_id = ''productos'' and public.tiene_rol(array[''admin'',''inventario'']))';
  execute 'drop policy if exists "vortex fotos borrar" on storage.objects';
  execute 'create policy "vortex fotos borrar" on storage.objects for delete to authenticated using (bucket_id = ''productos'' and public.tiene_rol(array[''admin'',''inventario'']))';
exception when others then
  raise notice 'No se pudieron crear los permisos de fotos: %', sqlerrm;
end $$;

-- =====================================================================
--  TIEMPO REAL: los dos socios ven los cambios del otro al instante
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['productos','producto_fotos','reservas','ventas','venta_items','pagos','clientes','lotes',
                           'proveedores','gastos','otros_ingresos','eventos','configuracion','perfiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null;  -- ya estaba agregada o no aplica
    end;
  end loop;
end $$;

-- =====================================================================
--  TIENDA EN LÍNEA: catálogo público, cuentas de clientes y pedidos web
--  Los clientes NO tienen perfil de personal: no pueden leer ninguna
--  tabla interna. Solo usan las funciones de esta sección, que devuelven
--  únicamente datos de compra (nunca costos, lotes ni finanzas).
-- =====================================================================

alter table public.clientes add column if not exists usuario_id uuid;
alter table public.clientes add column if not exists email text not null default '';
create unique index if not exists clientes_usuario_uq on public.clientes(usuario_id) where usuario_id is not null;

alter table public.reservas add column if not exists web boolean not null default false;
alter table public.reservas add column if not exists tipo_web text not null default '';   -- 'Compra' o 'Reserva'
alter table public.reservas add column if not exists pedido_web text not null default ''; -- WEB-001 (agrupa los pares de un pedido)
create sequence if not exists public.seq_pedido_web;

-- Las cuentas de clientes no reciben perfil de personal (así nunca ven datos internos)
create or replace function public._nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data->>'tipo', '') = 'cliente' then
    return new;
  end if;
  insert into public.perfiles(id, nombre, email, rol, activo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(coalesce(new.email,''), '@', 1)), coalesce(new.email, ''), 'vendedor', false)
  on conflict (id) do nothing;
  return new;
end $$;

-- Libera reservas vencidas sin adelanto (lo usa también el catálogo público)
create or replace function public._liberar_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from public.reservas
            where estado = 'Activa' and vence < now() and adelanto = 0
            for update skip locked loop
    update public.reservas
       set estado = 'Cancelada',
           obs = case when obs = '' then 'Venció sin confirmarse' else obs || ' (venció sin confirmarse)' end
     where id = r.id;
    perform set_config('vortex.interno', 'si', true);
    update public.productos set estado = 'Disponible' where id = r.producto_id and estado = 'Reservado';
    perform public._audit(null, 'Liberó reserva vencida', r.id, 'El par volvió a disponibles automáticamente');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public._liberar_vencidas() from public, anon, authenticated;

create or replace function public.liberar_reservas_vencidas()
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.es_activo() then return 0; end if;
  return public._liberar_vencidas();
end $$;

-- Catálogo público: solo pares disponibles y solo datos de compra
create or replace function public.catalogo_publico()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._liberar_vencidas();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'codigo', p.codigo, 'marca', p.marca, 'modelo', p.modelo, 'categoria', p.categoria,
      'talla', p.talla, 'cm', p.cm, 'color', p.color, 'estado_fisico', p.estado_fisico,
      'descripcion', p.descripcion, 'precio', p.precio, 'ingreso', p.fecha_ingreso,
      'fotos', coalesce((select jsonb_agg(f.ruta order by f.orden, f.creado_en) from public.producto_fotos f where f.producto_id = p.id), '[]'::jsonb)
    ) order by p.fecha_ingreso desc, p.codigo desc)
    from public.productos p
    where p.estado = 'Disponible'), '[]'::jsonb);
end $$;

-- Datos públicos de la tienda (lugares de encomienda y horas de reserva)
create or replace function public.tienda_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('destinos', c.destinos, 'vigencia_horas', c.vigencia_horas) from public.configuracion c where id = 1
$$;

-- Crear cuenta de cliente (no necesita confirmar correo ni configurar nada en Supabase)
create or replace function public.registrar_cuenta_cliente(
  p_email text, p_password text, p_nombre text, p_telefono text, p_zona text, p_direccion text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_new uuid := gen_random_uuid();
  c record;
  v_existe boolean;
begin
  if v_nombre = '' or length(v_nombre) > 80 then raise exception 'Escribe tu nombre completo.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 120 then raise exception 'Escribe un correo válido.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres.'; end if;
  if length(regexp_replace(v_tel, '[^0-9]', '', 'g')) < 7 or length(v_tel) > 16 then raise exception 'Escribe un número de teléfono válido.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Ya existe una cuenta con ese correo. Inicia sesión.';
  end if;
  -- Freno simple contra registros masivos
  if (select count(*) from public.clientes where usuario_id is not null and creado_en > now() - interval '1 hour') >= 40 then
    raise exception 'Hay muchos registros en este momento. Inténtalo en unos minutos.';
  end if;

  select * into c from public.clientes where telefono = v_tel for update;
  v_existe := found;
  if v_existe and c.usuario_id is not null then
    raise exception 'Ese teléfono ya tiene una cuenta. Inicia sesión con tu correo.';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_new, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"],"tipo":"cliente"}'::jsonb, jsonb_build_object('nombre', v_nombre),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_new, v_new::text,
          jsonb_build_object('sub', v_new::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
          'email', now(), now(), now());

  if v_existe then
    -- El cliente ya compró antes (lo registró el personal): se vincula sin mostrarle su historial anterior
    update public.clientes
       set usuario_id = v_new, email = v_email,
           zona = case when zona = '' then left(trim(coalesce(p_zona, '')), 60) else zona end,
           direccion = case when direccion = '' then left(trim(coalesce(p_direccion, '')), 200) else direccion end
     where id = c.id;
  else
    insert into public.clientes(nombre, telefono, zona, direccion, obs, usuario_id, email, creado_por)
    values (v_nombre, v_tel, left(trim(coalesce(p_zona, '')), 60), left(trim(coalesce(p_direccion, '')), 200),
            'Se registró en la tienda en línea', v_new, v_email, null);
  end if;
  perform public._audit(null, 'Cliente creó su cuenta', v_nombre, v_email);
end $$;

-- Cliente conectado (o nada si la cuenta no es de cliente)
create or replace function public._mi_cliente() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clientes where usuario_id = auth.uid() and auth.uid() is not null
$$;
revoke execute on function public._mi_cliente() from public, anon, authenticated;

create or replace function public.cliente_mi_cuenta()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono, 'zona', c.zona,
                            'direccion', c.direccion, 'email', c.email)
    from public.clientes c where c.id = public._mi_cliente()
$$;

create or replace function public.cliente_actualizar(p_nombre text, p_zona text, p_direccion text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c uuid := public._mi_cliente();
begin
  if v_c is null then raise exception 'Inicia sesión con tu cuenta de cliente.'; end if;
  if trim(coalesce(p_nombre, '')) = '' then raise exception 'Escribe tu nombre.'; end if;
  update public.clientes set nombre = left(trim(p_nombre), 80), zona = left(trim(coalesce(p_zona, '')), 60),
         direccion = left(trim(coalesce(p_direccion, '')), 200)
   where id = v_c;
end $$;

-- Pedido desde la tienda: aparta los pares (quedan reservados) hasta que el personal lo confirme
create or replace function public.cliente_pedir(p_productos uuid[], p_tipo text, p_envio jsonb, p_nota text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_c uuid := public._mi_cliente();
  v_tipo text := case when p_tipo = 'Reserva' then 'Reserva' else 'Compra' end;
  v_entrega text := coalesce(p_envio->>'entrega', '');
  v_envio jsonb;
  v_horas int := coalesce((select vigencia_horas from public.configuracion where id = 1), 48);
  v_grupo text;
  v_res text;
  p record;
  n int := coalesce(array_length(p_productos, 1), 0);
begin
  if v_c is null then raise exception 'Inicia sesión con tu cuenta de cliente para hacer pedidos.'; end if;
  if n = 0 then raise exception 'Elige al menos un par.'; end if;
  if n > 5 then raise exception 'Puedes pedir hasta 5 pares a la vez.'; end if;
  if (select count(*) from public.reservas where cliente_id = v_c and web and estado = 'Activa') + n > 5 then
    raise exception 'Ya tienes pares apartados. Puedes tener hasta 5 a la vez; espera a que confirmemos tu pedido.';
  end if;
  if v_entrega not in ('Recojo en punto', 'Delivery Cochabamba', 'Encomienda') then raise exception 'Elige cómo quieres recibir tu pedido.'; end if;
  if v_entrega = 'Delivery Cochabamba' and trim(coalesce(p_envio->>'direccion', '')) = '' then raise exception 'Escribe la dirección de entrega.'; end if;
  if v_entrega = 'Encomienda' and trim(coalesce(p_envio->>'destino', '')) = '' then raise exception 'Elige a qué ciudad o lugar se envía.'; end if;

  -- Solo se guardan los datos de entrega que corresponden (nada de costos desde el cliente)
  v_envio := jsonb_build_object(
    'entrega', v_entrega,
    'direccion', left(trim(coalesce(p_envio->>'direccion', '')), 200),
    'destino', left(trim(coalesce(p_envio->>'destino', '')), 80),
    'transportista', left(trim(coalesce(p_envio->>'transportista', '')), 80),
    'pagaCliente', v_entrega <> 'Recojo en punto',
    'delivery', 0);

  -- Primero se bloquean y revisan todos los pares; recién después se numera el pedido
  for p in select * from public.productos where id = any(p_productos) order by codigo for update loop
    if p.estado <> 'Disponible' then
      raise exception '% ya no está disponible. Quítalo de tu pedido e inténtalo otra vez.', p.marca || ' ' || p.modelo || ' (' || p.codigo || ')';
    end if;
  end loop;
  if (select count(*) from public.productos where id = any(p_productos)) <> n then
    raise exception 'Uno de los pares ya no está en el catálogo. Recarga la página.';
  end if;

  v_grupo := public._codigo('WEB-', nextval('public.seq_pedido_web'), 3);
  for p in select * from public.productos where id = any(p_productos) order by codigo loop
    v_res := public._codigo('RES-', nextval('public.seq_reserva'), 3);
    insert into public.reservas(id, producto_id, cliente_id, canal, vence, adelanto, estado, envio, obs, web, tipo_web, pedido_web, creado_por)
    values (v_res, p.id, v_c, 'App VORTEX', now() + make_interval(hours => v_horas), 0, 'Activa', v_envio,
            left(trim(coalesce(p_nota, '')), 300), true, v_tipo, v_grupo, null);
    perform set_config('vortex.interno', 'si', true);
    update public.productos set estado = 'Reservado' where id = p.id;
  end loop;

  perform public._audit(null, 'Pedido de la tienda en línea', v_grupo,
    format('%s · %s par(es) · %s', v_tipo, n, v_entrega));
  return v_grupo;
end $$;

-- Pedidos del cliente conectado (solo los que hizo desde la tienda)
create or replace function public.cliente_mis_pedidos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'creado' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'reserva', r.id, 'pedido', r.pedido_web, 'tipo', r.tipo_web, 'estado', r.estado, 'vence', r.vence,
      'creado', r.creado_en, 'envio', r.envio, 'obs', case when r.estado = 'Cancelada' then r.obs else '' end,
      'par', jsonb_build_object('codigo', p.codigo, 'marca', p.marca, 'modelo', p.modelo, 'talla', p.talla, 'cm', p.cm,
             'color', p.color, 'precio', coalesce(vi.precio, p.precio),
             'foto', (select f.ruta from public.producto_fotos f where f.producto_id = p.id order by f.orden, f.creado_en limit 1)),
      'venta', case when v.id is null then null else jsonb_build_object(
             'id', v.id, 'estado', v.estado, 'entrega', v.pedido, 'regalo', v.regalo,
             'total', (select coalesce(sum(i.precio), 0) from public.venta_items i where i.venta_id = v.id and i.activo),
             'pagado', (select coalesce(sum(pg.monto), 0) from public.pagos pg where pg.venta_id = v.id and not pg.anulado)) end
    ) as x
    from public.reservas r
    join public.productos p on p.id = r.producto_id
    left join public.ventas v on v.id = r.venta_id
    left join public.venta_items vi on vi.venta_id = v.id and vi.producto_id = p.id and vi.activo
    where r.web and r.cliente_id = public._mi_cliente()
  ) t
$$;

-- El cliente puede cancelar un par que todavía no fue confirmado
create or replace function public.cliente_cancelar(p_reserva text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c uuid := public._mi_cliente();
  r record;
begin
  if v_c is null then raise exception 'Inicia sesión con tu cuenta de cliente.'; end if;
  select * into r from public.reservas where id = p_reserva and cliente_id = v_c and web for update;
  if not found then raise exception 'No encontramos ese pedido.'; end if;
  if r.estado <> 'Activa' then raise exception 'Ese pedido ya no se puede cancelar.'; end if;
  if r.adelanto > 0 then raise exception 'Ese pedido ya tiene un pago. Escríbenos para cancelarlo.'; end if;
  update public.reservas set estado = 'Cancelada', obs = 'Cancelado por el cliente' where id = r.id;
  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Disponible' where id = r.producto_id and estado = 'Reservado';
  perform public._audit(null, 'Cliente canceló pedido', r.id, r.pedido_web);
end $$;

grant execute on function public.catalogo_publico() to anon, authenticated;
grant execute on function public.tienda_config() to anon, authenticated;
grant execute on function public.registrar_cuenta_cliente(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.cliente_mi_cuenta() to authenticated;
grant execute on function public.cliente_actualizar(text, text, text) to authenticated;
grant execute on function public.cliente_pedir(uuid[], text, jsonb, text) to authenticated;
grant execute on function public.cliente_mis_pedidos() to authenticated;
grant execute on function public.cliente_cancelar(text) to authenticated;

-- =====================================================================
--  QR DE PAGO: una imagen de QR (con su monto) que se asigna a uno o
--  varios pares. Varios pares del mismo precio pueden usar el mismo QR.
--  El cliente lo ve en "Mis pedidos" después de apartar el par.
-- =====================================================================

create table if not exists public.qr_pagos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null default '',
  monto      numeric(12,2) check (monto is null or monto > 0),
  ruta       text not null,
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);
alter table public.qr_pagos enable row level security;
drop policy if exists vx_leer on public.qr_pagos;
create policy vx_leer on public.qr_pagos for select to authenticated using (public.es_activo());

alter table public.productos add column if not exists qr_id uuid references public.qr_pagos(id) on delete set null;
create index if not exists productos_qr_idx on public.productos(qr_id);

-- Registrar un QR ya subido a la carpeta de fotos (carpeta "qr/")
create or replace function public.crear_qr(p_nombre text, p_monto numeric, p_ruta text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','inventario']);
  v_id uuid;
begin
  if coalesce(trim(p_ruta), '') = '' or p_ruta !~ '^qr/' then raise exception 'Sube la imagen del QR.'; end if;
  if p_monto is not null and p_monto <= 0 then raise exception 'El monto del QR debe ser mayor a cero.'; end if;
  insert into public.qr_pagos(nombre, monto, ruta, creado_por)
  values (coalesce(nullif(left(trim(p_nombre), 60), ''), case when p_monto is null then 'QR monto libre' else 'QR Bs ' || p_monto end), p_monto, p_ruta, v)
  returning id into v_id;
  perform public._audit(v, 'Subió QR de pago', coalesce(nullif(trim(p_nombre), ''), 'QR'), coalesce('Bs ' || p_monto, 'monto libre'));
  return v_id;
end $$;

create or replace function public.editar_qr(p_qr uuid, p_nombre text, p_monto numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._exigir(array['admin','inventario']);
begin
  if p_monto is not null and p_monto <= 0 then raise exception 'El monto del QR debe ser mayor a cero.'; end if;
  update public.qr_pagos set nombre = coalesce(nullif(left(trim(p_nombre), 60), ''), nombre), monto = p_monto where id = p_qr;
  if not found then raise exception 'Ese QR ya no existe.'; end if;
  perform public._audit(v, 'Editó QR de pago', coalesce(p_nombre, ''), coalesce('Bs ' || p_monto, 'monto libre'));
end $$;

-- Asignar un QR a varios pares a la vez.
--  p_qr nulo        → quita el QR de esos pares
--  p_reemplazar = sí → los pares que tenían este QR y no están en la lista lo pierden
create or replace function public.asignar_qr(p_qr uuid, p_productos uuid[], p_reemplazar boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','inventario']);
  v_nombre text;
  n int;
begin
  if p_qr is not null then
    select nombre into v_nombre from public.qr_pagos where id = p_qr;
    if not found then raise exception 'Ese QR ya no existe.'; end if;
  end if;
  perform set_config('vortex.interno', 'si', true);
  if p_qr is not null and coalesce(p_reemplazar, false) then
    update public.productos set qr_id = null
     where qr_id = p_qr and not (id = any(coalesce(p_productos, '{}'::uuid[])));
  end if;
  update public.productos set qr_id = p_qr
   where id = any(coalesce(p_productos, '{}'::uuid[])) and estado <> 'Eliminado';
  get diagnostics n = row_count;
  perform public._audit(v, case when p_qr is null then 'Quitó QR de pares' else 'Asignó QR a pares' end,
                        coalesce(v_nombre, 'QR'), format('%s par(es)', n));
  return n;
end $$;

-- Eliminar un QR: los pares quedan sin QR. Devuelve la ruta para borrar la imagen.
create or replace function public.eliminar_qr(p_qr uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','inventario']);
  q record;
begin
  select * into q from public.qr_pagos where id = p_qr for update;
  if not found then raise exception 'Ese QR ya no existe.'; end if;
  perform set_config('vortex.interno', 'si', true);
  update public.productos set qr_id = null where qr_id = p_qr;
  delete from public.qr_pagos where id = p_qr;
  perform public._audit(v, 'Eliminó QR de pago', q.nombre, '');
  return q.ruta;
end $$;

-- Pedidos del cliente: ahora incluyen el QR para pagar mientras falte pagar
create or replace function public.cliente_mis_pedidos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'creado' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'reserva', r.id, 'pedido', r.pedido_web, 'tipo', r.tipo_web, 'estado', r.estado, 'vence', r.vence,
      'creado', r.creado_en, 'envio', r.envio, 'obs', case when r.estado = 'Cancelada' then r.obs else '' end,
      'par', jsonb_build_object('codigo', p.codigo, 'marca', p.marca, 'modelo', p.modelo, 'talla', p.talla, 'cm', p.cm,
             'color', p.color, 'precio', coalesce(vi.precio, p.precio),
             'foto', (select f.ruta from public.producto_fotos f where f.producto_id = p.id order by f.orden, f.creado_en limit 1)),
      'qr', case when q.id is not null and (r.estado = 'Activa' or (v.id is not null and v.estado = 'Activa' and not v.regalo
                  and (select coalesce(sum(pg.monto), 0) from public.pagos pg where pg.venta_id = v.id and not pg.anulado)
                    < (select coalesce(sum(i.precio), 0) from public.venta_items i where i.venta_id = v.id and i.activo)))
             then jsonb_build_object('ruta', q.ruta, 'monto', q.monto, 'nombre', q.nombre) else null end,
      'venta', case when v.id is null then null else jsonb_build_object(
             'id', v.id, 'estado', v.estado, 'entrega', v.pedido, 'regalo', v.regalo,
             'total', (select coalesce(sum(i.precio), 0) from public.venta_items i where i.venta_id = v.id and i.activo),
             'pagado', (select coalesce(sum(pg.monto), 0) from public.pagos pg where pg.venta_id = v.id and not pg.anulado)) end
    ) as x
    from public.reservas r
    join public.productos p on p.id = r.producto_id
    left join public.qr_pagos q on q.id = p.qr_id
    left join public.ventas v on v.id = r.venta_id
    left join public.venta_items vi on vi.venta_id = v.id and vi.producto_id = p.id and vi.activo
    where r.web and r.cliente_id = public._mi_cliente()
  ) t
$$;

grant execute on function public.crear_qr(text, numeric, text) to authenticated;
grant execute on function public.editar_qr(uuid, text, numeric) to authenticated;
grant execute on function public.asignar_qr(uuid, uuid[], boolean) to authenticated;
grant execute on function public.eliminar_qr(uuid) to authenticated;
grant execute on function public.cliente_mis_pedidos() to authenticated;

-- =====================================================================
--  PAGO CON COMPROBANTE (tienda en línea)
--  El cliente compra (ya no reserva), paga con el QR y sube la foto del
--  comprobante. Queda "En revisión" hasta que el personal lo aprueba:
--  al aprobarlo se registra la venta pagada y la imagen se borra.
--  Entrega solo por paquetería: en Cochabamba o envío a provincias/otro país.
-- =====================================================================

create table if not exists public.comprobantes (
  id           uuid primary key default gen_random_uuid(),
  pedido_web   text not null,
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  ruta         text,                -- vacío cuando la imagen ya se borró
  monto        numeric(12,2) check (monto is null or monto > 0),
  estado       text not null default 'En revisión' check (estado in ('En revisión','Aprobado','Rechazado')),
  motivo       text not null default '',
  venta_id     text references public.ventas(id) on delete set null,
  revisado_por uuid,
  revisado_en  timestamptz,
  creado_en    timestamptz not null default now()
);
create index if not exists comprobantes_pedido_idx on public.comprobantes(pedido_web);
alter table public.comprobantes enable row level security;
drop policy if exists vx_leer on public.comprobantes;
create policy vx_leer on public.comprobantes for select to authenticated using (public.es_activo());

do $$
begin
  execute 'alter publication supabase_realtime add table public.comprobantes';
exception when others then null;
end $$;

-- Carpeta PRIVADA "comprobantes": solo el cliente dueño y el personal de ventas pueden verla
do $$
begin
  begin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('comprobantes', 'comprobantes', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
    on conflict (id) do update set public = false;
  exception when others then
    insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false)
    on conflict (id) do update set public = false;
  end;
exception when others then
  raise notice 'No se pudo crear la carpeta de comprobantes automáticamente: %', sqlerrm;
end $$;

do $$
begin
  execute 'drop policy if exists "vortex comprobantes subir" on storage.objects';
  execute 'create policy "vortex comprobantes subir" on storage.objects for insert to authenticated with check (bucket_id = ''comprobantes'' and (storage.foldername(name))[1] = auth.uid()::text)';
  execute 'drop policy if exists "vortex comprobantes ver" on storage.objects';
  execute 'create policy "vortex comprobantes ver" on storage.objects for select to authenticated using (bucket_id = ''comprobantes'' and ((storage.foldername(name))[1] = auth.uid()::text or public.tiene_rol(array[''admin'',''vendedor''])))';
  execute 'drop policy if exists "vortex comprobantes borrar" on storage.objects';
  execute 'create policy "vortex comprobantes borrar" on storage.objects for delete to authenticated using (bucket_id = ''comprobantes'' and ((storage.foldername(name))[1] = auth.uid()::text or public.tiene_rol(array[''admin'',''vendedor''])))';
exception when others then
  raise notice 'No se pudieron crear los permisos de comprobantes: %', sqlerrm;
end $$;

-- Un pedido con comprobante en revisión NO vence (estamos verificando el pago)
create or replace function public._liberar_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in select * from public.reservas rv
            where rv.estado = 'Activa' and rv.vence < now() and rv.adelanto = 0
              and not (rv.web and exists (select 1 from public.comprobantes c
                                           where c.pedido_web = rv.pedido_web and c.estado = 'En revisión'))
            for update skip locked loop
    update public.reservas
       set estado = 'Cancelada',
           obs = case when web then 'No se recibió el pago a tiempo'
                      when obs = '' then 'Venció sin confirmarse' else obs || ' (venció sin confirmarse)' end
     where id = r.id;
    perform set_config('vortex.interno', 'si', true);
    update public.productos set estado = 'Disponible' where id = r.producto_id and estado = 'Reservado';
    perform public._audit(null, 'Liberó reserva vencida', r.id, 'El par volvió a disponibles automáticamente');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public._liberar_vencidas() from public, anon, authenticated;

-- Pedido desde la tienda: siempre es COMPRA y siempre por paquetería
--  • Paquetería en Cochabamba (destino = Cochabamba)
--  • Envío a provincias u otro país (destino escrito por el cliente)
create or replace function public.cliente_pedir(p_productos uuid[], p_tipo text, p_envio jsonb, p_nota text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_c uuid := public._mi_cliente();
  v_modo text := coalesce(p_envio->>'modo', '');
  v_destino text := left(trim(coalesce(p_envio->>'destino', '')), 80);
  v_envio jsonb;
  v_horas int := coalesce((select vigencia_horas from public.configuracion where id = 1), 48);
  v_grupo text;
  v_res text;
  p record;
  n int := coalesce(array_length(p_productos, 1), 0);
begin
  if v_c is null then raise exception 'Inicia sesión con tu cuenta de cliente para hacer pedidos.'; end if;
  if n = 0 then raise exception 'Elige al menos un par.'; end if;
  if n > 5 then raise exception 'Puedes pedir hasta 5 pares a la vez.'; end if;
  if (select count(*) from public.reservas where cliente_id = v_c and web and estado = 'Activa') + n > 5 then
    raise exception 'Ya tienes pares apartados. Puedes tener hasta 5 a la vez; paga o cancela los que tienes.';
  end if;
  if v_modo = 'cochabamba' then
    v_destino := 'Cochabamba';
  elsif v_modo = 'envio' then
    if v_destino = '' then raise exception 'Escribe a qué ciudad, provincia o país se envía.'; end if;
  else
    raise exception 'Elige cómo quieres recibir tu pedido.';
  end if;

  -- Solo se guardan los datos de entrega que corresponden (nada de costos desde el cliente)
  v_envio := jsonb_build_object(
    'entrega', 'Encomienda',
    'modo', v_modo,
    'destino', v_destino,
    'transportista', left(trim(coalesce(p_envio->>'transportista', '')), 80),
    'recibe', left(trim(coalesce(p_envio->>'recibe', '')), 120),
    'direccion', '',
    'pagaCliente', true,
    'delivery', 0);

  for p in select * from public.productos where id = any(p_productos) order by codigo for update loop
    if p.estado <> 'Disponible' then
      raise exception '% ya no está disponible. Quítalo de tu pedido e inténtalo otra vez.', p.marca || ' ' || p.modelo || ' (' || p.codigo || ')';
    end if;
  end loop;
  if (select count(*) from public.productos where id = any(p_productos)) <> n then
    raise exception 'Uno de los pares ya no está en el catálogo. Recarga la página.';
  end if;

  v_grupo := public._codigo('WEB-', nextval('public.seq_pedido_web'), 3);
  for p in select * from public.productos where id = any(p_productos) order by codigo loop
    v_res := public._codigo('RES-', nextval('public.seq_reserva'), 3);
    insert into public.reservas(id, producto_id, cliente_id, canal, vence, adelanto, estado, envio, obs, web, tipo_web, pedido_web, creado_por)
    values (v_res, p.id, v_c, 'App VORTEX', now() + make_interval(hours => v_horas), 0, 'Activa', v_envio,
            left(trim(coalesce(p_nota, '')), 300), true, 'Compra', v_grupo, null);
    perform set_config('vortex.interno', 'si', true);
    update public.productos set estado = 'Reservado' where id = p.id;
  end loop;

  perform public._audit(null, 'Pedido de la tienda en línea', v_grupo,
    format('Compra · %s par(es) · paquetería %s', n, v_destino));
  return v_grupo;
end $$;

-- El cliente sube su comprobante (la imagen ya está en su carpeta de "comprobantes")
create or replace function public.cliente_subir_comprobante(p_pedido text, p_ruta text, p_monto numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_c uuid := public._mi_cliente();
  v_id uuid;
begin
  if v_c is null then raise exception 'Inicia sesión con tu cuenta de cliente.'; end if;
  if coalesce(p_ruta, '') = '' or p_ruta not like auth.uid()::text || '/%' or length(p_ruta) > 200 then
    raise exception 'Sube la foto de tu comprobante.';
  end if;
  if p_monto is not null and p_monto <= 0 then raise exception 'Revisa el monto pagado.'; end if;
  perform 1 from public.reservas
   where pedido_web = p_pedido and cliente_id = v_c and web and estado = 'Activa' for update;
  if not found then raise exception 'Este pedido ya no está esperando pago.'; end if;
  if exists (select 1 from public.comprobantes where pedido_web = p_pedido and estado = 'En revisión') then
    raise exception 'Ya enviaste un comprobante para este pedido. Lo estamos revisando.';
  end if;
  insert into public.comprobantes(pedido_web, cliente_id, ruta, monto)
  values (p_pedido, v_c, p_ruta, p_monto) returning id into v_id;
  perform public._audit(null, 'Cliente subió comprobante', p_pedido, coalesce('Bs ' || p_monto, 'sin monto'));
  return v_id;
end $$;

-- Aprobar el pago: registra la venta (pagada) con la fecha de envío y deja el comprobante aprobado.
-- Devuelve la venta y la ruta de la imagen para borrarla (ya está registrada en el banco).
create or replace function public.aprobar_comprobante(p_comprobante uuid, p_monto numeric, p_metodo text, p_fecha_envio date, p_guia text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  c record;
  r record;
  v_res text[];
  v_items jsonb;
  v_total numeric;
  v_adelantos numeric;
  v_pago numeric;
  v_entrega jsonb;
  v_venta text;
begin
  select * into c from public.comprobantes where id = p_comprobante for update;
  if not found then raise exception 'Ese comprobante ya no existe.'; end if;
  if c.estado <> 'En revisión' then raise exception 'Ese comprobante ya fue revisado.'; end if;

  select array_agg(rv.id order by rv.id),
         jsonb_agg(jsonb_build_object('producto_id', rv.producto_id, 'precio', pr.precio)),
         coalesce(sum(pr.precio), 0)
    into v_res, v_items, v_total
    from public.reservas rv join public.productos pr on pr.id = rv.producto_id
   where rv.pedido_web = c.pedido_web and rv.web and rv.estado = 'Activa';

  if v_res is null then
    -- La venta ya se registró a mano: solo se cierra el comprobante
    select venta_id into v_venta from public.reservas
     where pedido_web = c.pedido_web and web and estado = 'Convertida' and venta_id is not null limit 1;
    if v_venta is null then raise exception 'Este pedido ya no tiene pares apartados (se canceló o venció).'; end if;
  else
    select * into r from public.reservas where id = v_res[1];
    select coalesce(sum(monto), 0) into v_adelantos from public.pagos
     where reserva_id = any(v_res) and not anulado and venta_id is null;
    v_pago := coalesce(p_monto, v_total - v_adelantos);
    if v_pago < 0 then v_pago := 0; end if;
    v_entrega := jsonb_build_object(
      'tipo', 'Encomienda', 'destino', coalesce(r.envio->>'destino', ''), 'transportista', coalesce(r.envio->>'transportista', ''),
      'recibe', coalesce(r.envio->>'recibe', ''), 'modo', coalesce(r.envio->>'modo', ''), 'direccion', '',
      'costo', 0, 'pagaCliente', true, 'fechaEstimada', p_fecha_envio, 'guia', left(trim(coalesce(p_guia, '')), 80));
    v_venta := public.registrar_venta(c.cliente_id, 'App VORTEX', v_items, v_res, v_pago, coalesce(nullif(p_metodo, ''), 'QR'),
                                      v_entrega, 'Pago verificado con comprobante · ' || c.pedido_web, false, false);
  end if;

  update public.comprobantes
     set estado = 'Aprobado', venta_id = v_venta, ruta = null, revisado_por = v, revisado_en = now()
   where id = c.id;
  perform public._audit(v, 'Aprobó comprobante', c.pedido_web, v_venta);
  return jsonb_build_object('venta', v_venta, 'ruta', c.ruta);
end $$;

-- Rechazar: el cliente ve el motivo y puede subir otro. Se le dan 24 h más para pagar.
create or replace function public.rechazar_comprobante(p_comprobante uuid, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  c record;
begin
  if length(trim(coalesce(p_motivo, ''))) < 4 then raise exception 'Escribe el motivo para que el cliente sepa qué corregir.'; end if;
  select * into c from public.comprobantes where id = p_comprobante for update;
  if not found then raise exception 'Ese comprobante ya no existe.'; end if;
  if c.estado <> 'En revisión' then raise exception 'Ese comprobante ya fue revisado.'; end if;
  update public.comprobantes
     set estado = 'Rechazado', motivo = left(trim(p_motivo), 200), ruta = null, revisado_por = v, revisado_en = now()
   where id = c.id;
  update public.reservas set vence = greatest(vence, now() + interval '24 hours')
   where pedido_web = c.pedido_web and web and estado = 'Activa';
  perform public._audit(v, 'Rechazó comprobante', c.pedido_web, p_motivo);
  return c.ruta;
end $$;

-- Fecha de envío (o de entrega en paquetería) y número de guía, visibles para el cliente
create or replace function public.programar_envio(p_venta text, p_fecha date, p_guia text)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public._exigir(array['admin','vendedor','inventario']);
begin
  update public.ventas
     set entrega = coalesce(entrega, '{}'::jsonb) || jsonb_build_object('fechaEstimada', p_fecha, 'guia', left(trim(coalesce(p_guia, '')), 80))
   where id = p_venta and estado = 'Activa';
  if not found then raise exception 'La venta no existe o está anulada.'; end if;
  perform public._audit(v, 'Programó envío', p_venta, coalesce(p_fecha::text, 'sin fecha') || coalesce(' · guía ' || nullif(trim(p_guia), ''), ''));
end $$;

-- Pedidos del cliente: QR, comprobante y seguimiento del envío
create or replace function public.cliente_mis_pedidos()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'creado' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'reserva', r.id, 'pedido', r.pedido_web, 'tipo', r.tipo_web, 'estado', r.estado, 'vence', r.vence,
      'creado', r.creado_en, 'envio', r.envio, 'obs', case when r.estado = 'Cancelada' then r.obs else '' end,
      'par', jsonb_build_object('codigo', p.codigo, 'marca', p.marca, 'modelo', p.modelo, 'talla', p.talla, 'cm', p.cm,
             'color', p.color, 'precio', coalesce(vi.precio, p.precio),
             'foto', (select f.ruta from public.producto_fotos f where f.producto_id = p.id order by f.orden, f.creado_en limit 1)),
      'qr', case when q.id is not null and (r.estado = 'Activa' or (v.id is not null and v.estado = 'Activa' and not v.regalo
                  and (select coalesce(sum(pg.monto), 0) from public.pagos pg where pg.venta_id = v.id and not pg.anulado)
                    < (select coalesce(sum(i.precio), 0) from public.venta_items i where i.venta_id = v.id and i.activo)))
             then jsonb_build_object('ruta', q.ruta, 'monto', q.monto, 'nombre', q.nombre) else null end,
      'comprobante', (select jsonb_build_object('estado', cp.estado, 'motivo', cp.motivo, 'monto', cp.monto, 'creado', cp.creado_en)
                        from public.comprobantes cp where cp.pedido_web = r.pedido_web and cp.cliente_id = r.cliente_id
                       order by cp.creado_en desc limit 1),
      'venta', case when v.id is null then null else jsonb_build_object(
             'id', v.id, 'estado', v.estado, 'entrega', v.pedido, 'regalo', v.regalo,
             'fecha_envio', v.entrega->>'fechaEstimada', 'guia', coalesce(v.entrega->>'guia', ''),
             'total', (select coalesce(sum(i.precio), 0) from public.venta_items i where i.venta_id = v.id and i.activo),
             'pagado', (select coalesce(sum(pg.monto), 0) from public.pagos pg where pg.venta_id = v.id and not pg.anulado)) end
    ) as x
    from public.reservas r
    join public.productos p on p.id = r.producto_id
    left join public.qr_pagos q on q.id = p.qr_id
    left join public.ventas v on v.id = r.venta_id
    left join public.venta_items vi on vi.venta_id = v.id and vi.producto_id = p.id and vi.activo
    where r.web and r.cliente_id = public._mi_cliente()
  ) t
$$;

grant execute on function public.cliente_pedir(uuid[], text, jsonb, text) to authenticated;
grant execute on function public.cliente_subir_comprobante(text, text, numeric) to authenticated;
grant execute on function public.aprobar_comprobante(uuid, numeric, text, date, text) to authenticated;
grant execute on function public.rechazar_comprobante(uuid, text) to authenticated;
grant execute on function public.programar_envio(text, date, text) to authenticated;
grant execute on function public.cliente_mis_pedidos() to authenticated;

-- Con un comprobante en revisión el cliente ya no puede cancelar (estamos verificando su pago)
create or replace function public.cliente_cancelar(p_reserva text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c uuid := public._mi_cliente();
  r record;
begin
  if v_c is null then raise exception 'Inicia sesión con tu cuenta de cliente.'; end if;
  select * into r from public.reservas where id = p_reserva and cliente_id = v_c and web for update;
  if not found then raise exception 'No encontramos ese pedido.'; end if;
  if r.estado <> 'Activa' then raise exception 'Ese pedido ya no se puede cancelar.'; end if;
  if r.adelanto > 0 then raise exception 'Ese pedido ya tiene un pago. Escríbenos para cancelarlo.'; end if;
  if exists (select 1 from public.comprobantes where pedido_web = r.pedido_web and estado = 'En revisión') then
    raise exception 'Ya enviaste tu comprobante y lo estamos revisando. Escríbenos si necesitas cancelar.';
  end if;
  update public.reservas set estado = 'Cancelada', obs = 'Cancelado por el cliente' where id = r.id;
  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Disponible' where id = r.producto_id and estado = 'Reservado';
  perform public._audit(null, 'Cliente canceló pedido', r.id, r.pedido_web);
end $$;
grant execute on function public.cliente_cancelar(text) to authenticated;

-- Avisar a Supabase que hay funciones nuevas
notify pgrst, 'reload schema';

-- Fin. Ahora ejecuta 02_administrador.sql
