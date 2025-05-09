-- Drop the old function
drop function if exists public.get_new_api_keys;

-- Create new function that always returns API keys
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
      set key_hash = public.crypt(v_read_key, public.gen_salt('bf'))
      where database_id = p_database_id
      and permissions->>'write' = 'false';

      update public.api_keys
      set key_hash = public.crypt(v_write_key, public.gen_salt('bf'))
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
