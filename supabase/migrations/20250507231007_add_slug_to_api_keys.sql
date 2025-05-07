-- Add slug column to api_keys table
alter table public.api_keys
add column slug text;

-- Create a function to generate a random slug
create or replace function public.generate_unique_slug()
returns text
language plpgsql
as $$
declare
  new_slug text;
  done bool;
begin
  done := false;
  while not done loop
    -- Generate a random 12-character slug using lowercase letters and numbers
    new_slug := lower(substring(md5(random()::text) from 1 for 12));
    
    -- Check if this slug is already in use
    done := not exists(select 1 from public.api_keys where slug = new_slug);
  end loop;
  
  return new_slug;
end;
$$;

-- Create trigger function to set the slug
create or replace function public.set_api_key_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null then
    new.slug := public.generate_unique_slug();
  end if;
  return new;
end;
$$;

-- Add a trigger to automatically generate slugs for new API keys
create trigger set_api_key_slug
  before insert on public.api_keys
  for each row
  execute function public.set_api_key_slug();

-- Update existing records with slugs
update public.api_keys
set slug = public.generate_unique_slug()
where slug is null;

-- Make slug required and unique
alter table public.api_keys
alter column slug set not null,
add constraint api_keys_slug_unique unique (slug);

-- Create an index for faster slug lookups
create index api_keys_slug_idx on public.api_keys(slug);
