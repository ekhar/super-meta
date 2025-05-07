-- Seed file to create initial users and roles

-- First, ensure the auth.users table has our users
INSERT INTO auth.users (
    instance_id, 
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at
) VALUES 
  -- Admin user
  ('00000000-0000-0000-0000-000000000000',
   extensions.gen_random_uuid(),
   'authenticated',
   'authenticated',
   'admin@super-meta.com',
   crypt('supabase', gen_salt('bf', 10)),
   now(),
   NULL,
   '',
   NULL,
   '',
   now(),
   '',
   '',
   NULL,
   now(),
   '{"provider":"email","providers":["email"]}',
   '{}',
   NULL,
   now(),
   now(),
   NULL,
   NULL,
   '',
   '',
   NULL,
   '',
   0,
   NULL,
   '',
   NULL),
  -- Regular user
  ('00000000-0000-0000-0000-000000000000',
   extensions.gen_random_uuid(),
   'authenticated',
   'authenticated',
   'ericsrealemail@gmail.com',
   crypt('supabase', gen_salt('bf', 10)),
   now(),
   NULL,
   '',
   NULL,
   '',
   now(),
   '',
   '',
   NULL,
   now(),
   '{"provider":"email","providers":["email"]}',
   '{}',
   NULL,
   now(),
   now(),
   NULL,
   NULL,
   '',
   '',
   NULL,
   '',
   0,
   NULL,
   '',
   NULL);

-- Then set up their identities
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    id,
    id,
    email,
    json_build_object('sub', id::text, 'email', email),
    'email',
    now(),
    now(),
    now()
FROM auth.users;

-- Then set up their roles
INSERT INTO public.user_roles (id, role, email)
SELECT 
    id,
    CASE 
        WHEN email = 'admin@super-meta.com' THEN 'admin'::user_role
        ELSE 'user'::user_role
    END,
    email
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET role = EXCLUDED.role,
    email = EXCLUDED.email; 