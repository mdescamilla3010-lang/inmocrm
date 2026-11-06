-- =============================================================================
-- 0005 · Cada usuario puede leer su propio registro aunque esté desactivado.
--
-- app.inmobiliaria_id() devuelve null para usuarios inactivos, así que la
-- política "ver el equipo" no les deja ver ni su propia fila. Sin esto la app
-- no puede distinguir "usuario desactivado" de "usuario sin inmobiliaria".
-- =============================================================================

create policy "usuarios: ver mi registro" on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()));
