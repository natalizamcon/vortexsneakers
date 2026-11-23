-- =====================================================================
--  VORTEX SNEAKERS · Actualización: regalos, entrega inmediata, editar
--  ventas registradas y canales "Tienda física" y "App VORTEX"
--  ---------------------------------------------------------------------
--  Solo si YA tienes la base de datos creada con 01_base_de_datos.sql.
--  Incluye también las actualizaciones anteriores (03 y 04), así que
--  sirve aunque no las hayas ejecutado.
--  1. En Supabase abre "SQL Editor" → "New query".
--  2. Copia TODO este archivo, pégalo y presiona "Run".
--  3. Debe decir "Success". No borra ni cambia tus ventas ni pagos.
-- =====================================================================

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

-- ---------------------------------------------------------------------
-- Regalos
-- ---------------------------------------------------------------------
alter table public.ventas add column if not exists regalo boolean not null default false;
alter table public.venta_items add column if not exists precio_lista numeric(12,2);
-- Para las ventas que ya tenías: el precio de lista es el precio que tenía el par
update public.venta_items vi set precio_lista = pr.precio
  from public.productos pr
 where pr.id = vi.producto_id and vi.precio_lista is null;

-- ---------------------------------------------------------------------
-- Nuevos canales de venta
-- ---------------------------------------------------------------------
alter table public.configuracion alter column canales
  set default array['Facebook Live','Publicación Facebook','Instagram','TikTok','WhatsApp','Tienda física','App VORTEX'];
update public.configuracion set canales = canales || array['Tienda física'] where not ('Tienda física' = any(canales));
update public.configuracion set canales = canales || array['App VORTEX']    where not ('App VORTEX' = any(canales));

-- ---------------------------------------------------------------------
-- Ventas: registrar (con regalo y entrega inmediata) y modificar
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Avisar a Supabase que hay funciones nuevas (para que la app las vea
-- de inmediato) y mostrar el resultado
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

select
  case when exists (select 1 from pg_proc where proname = 'editar_venta' and pronamespace = 'public'::regnamespace)
        and exists (select 1 from pg_proc where proname = 'registrar_venta' and pronargs = 10 and pronamespace = 'public'::regnamespace)
        and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'regalo')
       then '✅ Actualización 05 aplicada correctamente. Ya puedes usar regalos y modificar ventas.'
       else '❌ Algo no se aplicó. Copia este mensaje y avísame.'
  end as resultado;
