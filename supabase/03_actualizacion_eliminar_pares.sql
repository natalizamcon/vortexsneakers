-- =====================================================================
--  VORTEX SNEAKERS · Actualización: eliminar pares del inventario
--  ---------------------------------------------------------------------
--  Solo si YA ejecutaste antes 01_base_de_datos.sql.
--  1. En Supabase abre "SQL Editor" → "New query".
--  2. Copia TODO este archivo, pégalo y presiona "Run".
--  3. Debe decir "Success". No borra ni cambia ningún dato.
-- =====================================================================

-- Pares eliminados (dados de baja): salen del inventario pero conservan su historial
alter table public.productos add column if not exists baja_motivo text not null default '';
alter table public.productos add column if not exists baja_en     timestamptz;
alter table public.productos add column if not exists baja_por    uuid;
alter table public.productos drop constraint if exists productos_estado_check;
alter table public.productos add constraint productos_estado_check
  check (estado in ('Disponible','Reservado','Vendido','Eliminado'));

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
