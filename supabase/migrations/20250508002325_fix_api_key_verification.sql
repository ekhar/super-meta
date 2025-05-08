-- Fix schema references for cryptographic functions
drop function if exists public.crypt;
drop function if exists public.gen_salt;
drop function if exists public.verify_api_key;

-- Create the verify_api_key function
create or replace function public.verify_api_key(
  api_key text,
  required_permission text default 'read'
)
returns table (
  database_id uuid
)
language plpgsql
security definer
as $$
begin
  return query
  select ak.database_id
  from public.api_keys ak
  where extensions.crypt(api_key, ak.key_hash) = ak.key_hash
  and ak.is_active = true
  and (
    (required_permission = 'read' and (ak.permissions->>'read')::boolean = true)
    or
    (required_permission = 'write' and (ak.permissions->>'write')::boolean = true)
  );
end;
$$;

-- Update existing functions to use extensions schema
create or replace function public.get_api_keys(p_database_id uuid)
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
  v_read_key text;
  v_write_key text;
  v_read_slug text;
  v_write_slug text;
begin
  -- Check if the user owns the database
  select owner_id into v_owner_id
  from public.databases
  where id = p_database_id;

  if v_owner_id != auth.uid() then
    raise exception 'Access denied';
  end if;

  -- Start a transaction
  begin
    -- First try to get from audit table (new keys)
    select
      a.read_key,
      a.write_key,
      k1.slug,
      k2.slug
    into
      v_read_key,
      v_write_key,
      v_read_slug,
      v_write_slug
    from public.new_api_keys_audit a
    join public.api_keys k1 on k1.database_id = a.database_id and k1.permissions->>'write' = 'false'
    join public.api_keys k2 on k2.database_id = a.database_id and k2.permissions->>'write' = 'true'
    where a.database_id = p_database_id
    and a.viewed_at is null
    limit 1;

    -- If no keys found, generate new ones
    if v_read_key is null then
      -- Generate new keys
      v_read_key := public.generate_api_key();
      v_write_key := public.generate_api_key();

      -- Get the slugs
      select k1.slug, k2.slug
      into v_read_slug, v_write_slug
      from public.api_keys k1
      join public.api_keys k2 on k2.database_id = k1.database_id
      where k1.database_id = p_database_id
      and k1.permissions->>'write' = 'false'
      and k2.permissions->>'write' = 'true'
      limit 1;

      -- Update existing keys with new hashes
      update public.api_keys
      set key_hash = extensions.crypt(v_read_key, extensions.gen_salt('bf'))
      where database_id = p_database_id
      and permissions->>'write' = 'false';

      update public.api_keys
      set key_hash = extensions.crypt(v_write_key, extensions.gen_salt('bf'))
      where database_id = p_database_id
      and permissions->>'write' = 'true';

      -- Store new keys in audit table
      insert into public.new_api_keys_audit (
        database_id,
        read_key,
        write_key,
        created_at
      ) values (
        p_database_id,
        v_read_key,
        v_write_key,
        now()
      );
    end if;

    -- Mark old keys as viewed
    update public.new_api_keys_audit
    set viewed_at = now()
    where database_id = p_database_id
    and viewed_at is null
    and created_at < now() - interval '5 minutes';

    -- Return the keys
    return query
    select v_read_key, v_write_key, v_read_slug, v_write_slug;
  end;
end;
$$;

-- Update create_default_api_keys to use extensions schema
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
