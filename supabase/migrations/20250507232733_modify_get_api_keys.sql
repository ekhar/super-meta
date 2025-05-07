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
begin
  -- Check if the user owns the database
  select owner_id into v_owner_id
  from public.databases
  where id = p_database_id;

  if v_owner_id != auth.uid() then
    raise exception 'Access denied';
  end if;

  -- Get and return the keys
  return query
  select 
    k1.key_hash as read_key,
    k2.key_hash as write_key,
    k1.slug as read_slug,
    k2.slug as write_slug
  from public.api_keys k1
  join public.api_keys k2 on k2.database_id = k1.database_id
  where k1.database_id = p_database_id
  and k1.permissions->>'read' = 'true'
  and k1.permissions->>'write' = 'false'
  and k2.permissions->>'read' = 'true'
  and k2.permissions->>'write' = 'true'
  limit 1;

  return;
end;
$$;
