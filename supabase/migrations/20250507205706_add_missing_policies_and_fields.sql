-- Wrap everything in a transaction
begin;

-- Add email field to user_roles table if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
    and table_name = 'user_roles'
    and column_name = 'email'
  ) then
    alter table public.user_roles
    add column email text;
  end if;
end $$;

-- Update existing rows with email from auth.users
update public.user_roles ur
set email = u.email
from auth.users u
where u.id = ur.id
and ur.email is null;

-- Make sure all rows have email populated
do $$
begin
  if exists (
    select 1 from public.user_roles where email is null
  ) then
    raise exception 'Some user_roles rows still have null email values';
  end if;
end $$;

-- Add unique constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
    and table_name = 'user_roles'
    and constraint_name = 'user_roles_email_unique'
  ) then
    alter table public.user_roles
    add constraint user_roles_email_unique unique (email);
  end if;
end $$;

-- Make email not null
alter table public.user_roles
alter column email set not null;

-- Update handle_new_user function to include email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (id, role, email)
  values (new.id, 'user', new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Add delete policy for databases table
create policy "Users can delete their own databases"
on public.databases
for delete
to authenticated
using (
  auth.uid() = owner_id or
  is_admin_for_policy()
);

commit;
