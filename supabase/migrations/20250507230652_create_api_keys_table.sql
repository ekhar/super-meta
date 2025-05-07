-- Create API keys table to manage external access to databases
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  database_id uuid not null references public.databases(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  permissions jsonb not null default '{"read": true, "write": false}'::jsonb,
  
  constraint valid_permissions check (
    permissions ?& array['read', 'write'] and
    (permissions->>'read')::boolean in (true, false) and
    (permissions->>'write')::boolean in (true, false)
  )
);

comment on table public.api_keys is 'Stores API keys for external access to databases';

-- Create indexes
create index api_keys_owner_id_idx on public.api_keys(owner_id);
create index api_keys_database_id_idx on public.api_keys(database_id);
create unique index api_keys_key_hash_idx on public.api_keys(key_hash);

-- Enable RLS
alter table public.api_keys enable row level security;

-- RLS Policies for authenticated users
create policy "Users can view their own API keys"
  on public.api_keys
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Users can create their own API keys"
  on public.api_keys
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Users can update their own API keys"
  on public.api_keys
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete their own API keys"
  on public.api_keys
  for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Create function to verify API key
create or replace function public.verify_api_key(api_key text, required_permission text default 'read')
returns uuid
language plpgsql
security definer
as $$
declare
  db_id uuid;
begin
  -- Get the database_id if the API key exists, is active, and not expired
  select database_id into db_id
  from public.api_keys
  where key_hash = public.crypt(api_key, key_hash)
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (permissions->>required_permission)::boolean = true;

  if db_id is null then
    raise exception 'Invalid or expired API key';
  end if;

  -- Update last used timestamp
  update public.api_keys
  set last_used_at = now()
  where key_hash = public.crypt(api_key, key_hash);

  return db_id;
end;
$$;
