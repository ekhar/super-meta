-- Migration: Initial schema setup
-- Description: Sets up user roles and databases schema

-- Create an enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    role user_role NOT NULL DEFAULT 'user',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_roles updated_at
CREATE TRIGGER update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_roles
CREATE POLICY "Users can read their own role"
    ON user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Admins can read all roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM user_roles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update roles"
    ON user_roles FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM user_roles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$ language plpgsql security definer;

-- Create trigger to automatically create user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_roles (id, role)
    VALUES (NEW.id, 'user');
    RETURN NEW;
END;
$$ language plpgsql security definer;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create databases table
CREATE TABLE public.databases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    storage_size_bytes bigint DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create trigger for databases updated_at
CREATE TRIGGER update_databases_updated_at
    BEFORE UPDATE ON databases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on databases
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for databases
CREATE POLICY "Users can read their own databases"
    ON databases FOR SELECT
    TO authenticated
    USING (
        auth.uid() = owner_id OR
        auth.uid() IN (
            SELECT id FROM user_roles WHERE role = 'admin'
        )
    );

CREATE POLICY "Users can insert their own databases"
    ON databases FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = owner_id
    );

CREATE POLICY "Users can update their own databases"
    ON databases FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = owner_id OR
        auth.uid() IN (
            SELECT id FROM user_roles WHERE role = 'admin'
        )
    );

-- Add notice for setting up initial admin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles WHERE role = 'admin'
    ) THEN
        RAISE NOTICE 'Remember to set the first admin user manually';
    END IF;
END
$$ language plpgsql;
