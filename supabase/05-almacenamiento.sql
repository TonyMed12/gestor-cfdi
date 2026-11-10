-- Almacenamiento privado de los archivos originales (RF-06, RNF-07, RNF-10). Ejecutar después de 04.
-- Los archivos se guardan como: <cliente_id>/<archivo_id>-<nombre>. La primera carpeta decide quién puede verlos.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'facturas', 'facturas', false, 20971520,  -- 20 MB por archivo
  array['text/xml', 'application/xml', 'application/pdf', 'image/jpeg', 'image/png',
        'application/zip', 'application/x-zip-compressed']
)
on conflict (id) do nothing;

-- Cliente al que pertenece una ruta; nulo si la ruta no empieza con un UUID.
create function public.cliente_de_ruta(ruta text) returns uuid
language sql immutable as $$
  select case
    when split_part(ruta, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(ruta, '/', 1)::uuid
  end
$$;

create policy "ver archivos de mi despacho" on storage.objects
  for select to authenticated
  using (bucket_id = 'facturas' and public.es_personal()
         and public.cliente_es_mio(public.cliente_de_ruta(name)));

create policy "subir archivos a mis clientes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and public.es_personal()
              and public.cliente_es_mio(public.cliente_de_ruta(name)));

-- No hay política de UPDATE: el original nunca se modifica. Solo el administrador puede borrar.
create policy "borrar archivos como administrador" on storage.objects
  for delete to authenticated
  using (bucket_id = 'facturas' and public.es_admin()
         and public.cliente_es_mio(public.cliente_de_ruta(name)));

commit;
