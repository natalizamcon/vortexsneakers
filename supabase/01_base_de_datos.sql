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
  canales            text[] not null default array['Facebook Live','Publicación Facebook','Instagram','TikTok','WhatsApp'],
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

-- Registrar una venta (directa o desde reservas)
create or replace function public.registrar_venta(
  p_cliente uuid, p_canal text, p_items jsonb, p_reservas text[],
  p_pago numeric, p_metodo text, p_entrega jsonb, p_obs text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v uuid := public._exigir(array['admin','vendedor']);
  v_id text;
  it record;
  p record;
  v_total numeric;
  v_pagado numeric;
  v_costo_envio numeric := coalesce(nullif(p_entrega->>'costo', '')::numeric, 0);
begin
  if p_cliente is null then raise exception 'Elige un cliente.'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un par a la venta.'; end if;

  for it in select * from jsonb_to_recordset(p_items) as x(producto_id uuid, precio numeric) loop
    select * into p from public.productos where id = it.producto_id for update;
    if not found then raise exception 'Uno de los pares no existe.'; end if;
    if p.estado = 'Vendido' then raise exception '% ya fue vendido. Revisa la venta.', p.codigo; end if;
    if p.estado = 'Reservado' and not exists (
      select 1 from public.reservas where producto_id = p.id and estado = 'Activa' and id = any(coalesce(p_reservas, '{}'::text[]))
    ) then
      raise exception '% está reservado para otro cliente.', p.codigo;
    end if;
    if it.precio is null or it.precio < 0 then raise exception 'Revisa el precio de %.', p.codigo; end if;
  end loop;

  v_id := public._codigo('VTA-', nextval('public.seq_venta'), 4);
  insert into public.ventas(id, fecha, cliente_id, canal, estado, obs, entrega, pedido, creado_por)
  values (v_id, public.hoy(), p_cliente, coalesce(p_canal, ''), 'Activa', coalesce(p_obs, ''), coalesce(p_entrega, '{}'::jsonb), 'Pendiente de preparación', v);

  insert into public.venta_items(venta_id, producto_id, precio, costo)
  select v_id, x.producto_id, x.precio, pr.costo_compra + pr.costo_transporte
    from jsonb_to_recordset(p_items) as x(producto_id uuid, precio numeric)
    join public.productos pr on pr.id = x.producto_id;

  perform set_config('vortex.interno', 'si', true);
  update public.productos set estado = 'Vendido'
   where id in (select (e->>'producto_id')::uuid from jsonb_array_elements(p_items) e);

  update public.reservas set estado = 'Convertida', venta_id = v_id
   where id = any(coalesce(p_reservas, '{}'::text[])) and estado = 'Activa';
  -- El adelanto de la reserva pasa a la venta (no se cuenta dos veces)
  update public.pagos set venta_id = v_id
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

  perform public._audit(v, 'Registró venta', v_id,
    format('%s par(es) — Bs %s — %s', jsonb_array_length(p_items), v_total, coalesce(p_canal, '')));
  return v_id;
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

-- Fin. Ahora ejecuta 02_administrador.sql
