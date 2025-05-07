-- Migration: Create admin user
-- Description: Sets up the initial admin user with email admin@admin.com
-- Note: Password will be hashed by Supabase auth

-- First, create the admin user in auth.users
-- The password will be hashed automatically by Supabase
do $$
declare
  admin_user_id uuid := gen_random_uuid();
begin
  -- Insert the admin user into auth.users
  insert into auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    is_super_admin,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    instance_id
  )
  values (
    admin_user_id,
    'admin@admin.com',
    -- Using Supabase's built-in password hashing function
    crypt('adminpassword', gen_salt('bf')),
    now(), -- Email automatically confirmed
    now(),
    true,  -- Mark as super admin
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );

  -- Add admin role to user_roles table if it doesn't exist
  insert into public.user_roles (id, role)
  values (admin_user_id, 'admin')
  on conflict (id) do update
  set role = 'admin';

  raise notice 'Created admin user with ID: %', admin_user_id;
end;
$$ language plpgsql;
