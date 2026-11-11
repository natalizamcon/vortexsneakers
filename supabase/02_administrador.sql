-- =====================================================================
--  VORTEX SNEAKERS · Activar al primer administrador
--  ---------------------------------------------------------------------
--  ANTES: crea el usuario en Supabase → Authentication → Users →
--         "Add user" → "Create new user" (con "Auto Confirm User" marcado).
--
--  1. Cambia SOLO las dos líneas marcadas con 👉 (correo y nombre).
--  2. Copia todo, pégalo en SQL Editor → New query → Run.
--  3. Debe decir "Success". Ya puedes entrar a la aplicación.
-- =====================================================================
do $$
declare
  v_email  text := 'tu-correo@ejemplo.com';   -- 👉 el MISMO correo que usaste en Authentication
  v_nombre text := 'Administrador';           -- 👉 tu nombre como quieres que aparezca
  v_id     uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(v_email));
  if v_id is null then
    raise exception 'No encontré el usuario %. Créalo primero en Authentication → Users y revisa que el correo esté bien escrito.', v_email;
  end if;

  insert into public.perfiles (id, nombre, email, rol, activo)
  values (v_id, v_nombre, lower(trim(v_email)), 'admin', true)
  on conflict (id) do update set rol = 'admin', activo = true, nombre = excluded.nombre, email = excluded.email;

  raise notice 'Listo: % ya es administrador de VORTEX SNEAKERS.', v_email;
end $$;
