-- Function to generate a secure random API key
create or replace function public.generate_api_key()
returns text
language plpgsql
as $$
declare
  -- Generate a 32-character random string for the API key
  new_key text := encode(extensions.gen_random_bytes(24), 'base64');
begin
  -- Remove any non-alphanumeric characters and trim to 32 chars
  new_key := regexp_replace(new_key, '[^a-zA-Z0-9]', '', 'g');
  return substring(new_key from 1 for 32);
end;
$$;

-- Function to create default API keys for a database
create or replace function public.create_default_api_keys()
returns trigger
language plpgsql
security definer
as $$
declare
  read_key text;
  write_key text;
  read_key_hash text;
  write_key_hash text;
begin
  -- Generate API keys
  read_key := public.generate_api_key();
  write_key := public.generate_api_key();
  
  -- Hash the keys
  read_key_hash := extensions.crypt(read_key, extensions.gen_salt('bf'));
  write_key_hash := extensions.crypt(write_key, extensions.gen_salt('bf'));

  -- Insert read-only API key
  insert into public.api_keys (
    name,
    key_hash,
    owner_id,
    database_id,
    permissions
  ) values (
    new.name || ' - Read Only',
    read_key_hash,
    new.owner_id,
    new.id,
    '{"read": true, "write": false}'::jsonb
  );

  -- Insert read-write API key
  insert into public.api_keys (
    name,
    key_hash,
    owner_id,
    database_id,
    permissions
  ) values (
    new.name || ' - Read Write',
    write_key_hash,
    new.owner_id,
    new.id,
    '{"read": true, "write": true}'::jsonb
  );

  -- Store the plain text keys temporarily in a separate audit table
  -- so they can be displayed to the user once after creation
  insert into public.new_api_keys_audit (
    database_id,
    read_key,
    write_key,
    created_at
  ) values (
    new.id,
    read_key,
    write_key,
    now()
  );

  return new;
end;
$$;

-- Create audit table to temporarily store new API keys
create table public.new_api_keys_audit (
  id uuid primary key default gen_random_uuid(),
  database_id uuid references public.databases(id) on delete cascade,
  read_key text,
  write_key text,
  created_at timestamptz not null,
  viewed_at timestamptz,
  constraint auto_delete_after_view check (
    viewed_at is null or
    viewed_at > created_at
  )
);

-- Enable RLS on the audit table
alter table public.new_api_keys_audit enable row level security;

-- RLS policy to only allow owners to view their keys
create policy "Users can view their own API keys audit"
  on public.new_api_keys_audit
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.databases
      where databases.id = new_api_keys_audit.database_id
      and databases.owner_id = auth.uid()
    )
  );

-- Function to get and mark API keys as viewed
create or replace function public.get_new_api_keys(p_database_id uuid)
returns table (
  read_key text,
  write_key text,
  read_slug text,
  write_slug text
)
language plpgsql
security definer
as $$
declare
  v_owner_id uuid;
begin
  -- Check if the user owns the database
  select owner_id into v_owner_id
  from public.databases
  where id = p_database_id;

  if v_owner_id != auth.uid() then
    raise exception 'Access denied';
  end if;

  -- Get and return the keys, then mark them as viewed
  return query
  with keys as (
    select
      a.read_key,
      a.write_key,
      (select slug from public.api_keys where key_hash = extensions.crypt(a.read_key, key_hash)) as read_slug,
      (select slug from public.api_keys where key_hash = extensions.crypt(a.write_key, key_hash)) as write_slug
    from public.new_api_keys_audit a
    where a.database_id = p_database_id
    and a.viewed_at is null
  )
  select * from keys;

  -- Mark keys as viewed
  update public.new_api_keys_audit
  set viewed_at = now()
  where database_id = p_database_id
  and viewed_at is null;

  return;
end;
$$;

-- Create a trigger to automatically generate API keys for new databases
create trigger create_default_api_keys_trigger
  after insert on public.databases
  for each row
  execute function public.create_default_api_keys();

-- Create a trigger to automatically delete viewed keys after 1 hour
create or replace function public.delete_viewed_api_keys()
returns trigger
language plpgsql
as $$
begin
  delete from public.new_api_keys_audit
  where viewed_at < now() - interval '1 hour';
  return null;
end;
$$;

create trigger delete_viewed_api_keys_trigger
  after update of viewed_at on public.new_api_keys_audit
  for each statement
  execute function public.delete_viewed_api_keys();
