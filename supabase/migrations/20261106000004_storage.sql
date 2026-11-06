-- =============================================================================
-- 0004 · Storage para fotos de propiedades
--
-- Bucket público de lectura: WhatsApp necesita una URL accesible para enviar
-- imágenes al prospecto. La escritura está restringida a la carpeta de la
-- inmobiliaria: <inmobiliaria_id>/<propiedad_id>/<archivo>.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propiedades', 'propiedades', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fotos propiedades: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'propiedades'
    and (storage.foldername(name))[1] = (select app.inmobiliaria_id())::text
  );

create policy "fotos propiedades: reemplazar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'propiedades'
    and (storage.foldername(name))[1] = (select app.inmobiliaria_id())::text
  );

create policy "fotos propiedades: borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'propiedades'
    and (storage.foldername(name))[1] = (select app.inmobiliaria_id())::text
  );
