-- Paso 3: primera tabla. Se pega en Supabase > SQL Editor > Run.

-- 1) La tabla. Un renglón = un cliente del despacho.
create table public.clientes (
  id           uuid primary key default gen_random_uuid(),
  razon_social text not null,
  rfc          text not null,
  user_id      uuid not null default auth.uid() references auth.users (id),
  creado_en    timestamptz not null default now(),
  unique (user_id, rfc)  -- un mismo usuario no repite RFC
);

-- 2) Seguridad por fila (RLS): cada usuario solo ve y edita SUS clientes.
alter table public.clientes enable row level security;

create policy "ver mis clientes" on public.clientes
  for select to authenticated using (user_id = auth.uid());

create policy "crear mis clientes" on public.clientes
  for insert to authenticated with check (user_id = auth.uid());

create policy "editar mis clientes" on public.clientes
  for update to authenticated using (user_id = auth.uid());

create policy "borrar mis clientes" on public.clientes
  for delete to authenticated using (user_id = auth.uid());

-- Nota: sinLeer / porRevisar / conError / faltantes NO se guardan aquí;
-- se calcularán contando facturas cuando exista esa tabla.
