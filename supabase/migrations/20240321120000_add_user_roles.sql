-- Migration: Add user roles and modify auth schema
-- Description: Adds role management for distinguishing between admin and regular users
-- Affected tables: auth.users, roles

-- Create an enum for user roles
create type public.user_role as enum ('admin', 'user');

-- Create roles table to track user roles
create table public.user_roles (
    id uuid references auth.users on delete cascade primary key,
    role user_role not null default 'user',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_roles enable row level security;

-- Create RLS policies for user_roles table
-- Allow users to read their own role
create policy "Users can read their own role"
    on public.user_roles
    for select
    using (auth.uid() = id);

-- Allow admins to read all roles
create policy "Admins can read all roles"
    on public.user_roles
    for select
    using (
        exists (
            select 1 
            from public.user_roles 
            where id = auth.uid() 
            and role = 'admin'
        )
    );

-- Allow admins to update roles
create policy "Admins can update roles"
    on public.user_roles
    for update
    using (
        exists (
            select 1 
            from public.user_roles 
            where id = auth.uid() 
            and role = 'admin'
        )
    );

-- Create function to check if user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1
    from public.user_roles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Create trigger to automatically create user role on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (id, role)
  values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Add initial admin user if not exists
do $$
begin
  if not exists (
    select 1 from public.user_roles where role = 'admin'
  ) then
    -- Note: Replace with actual admin user ID after first admin is created
    raise notice 'Remember to set the first admin user manually';
  end if;
end
$$ language plpgsql; 