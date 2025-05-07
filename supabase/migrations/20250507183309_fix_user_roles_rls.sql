-- Migration: Fix user_roles RLS policies to prevent infinite recursion
-- Description: Replaces the existing RLS policies with ones that avoid circular dependencies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON user_roles;

-- Create new RLS policies for user_roles that avoid circular dependencies
CREATE POLICY "Users can read their own role"
    ON user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Create a policy for admins that uses a security definer function
CREATE OR REPLACE FUNCTION is_admin_for_policy()
RETURNS boolean AS $$
BEGIN
    -- This function has security definer, so it bypasses RLS
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ language plpgsql security definer;

-- New admin read policy using the security definer function
CREATE POLICY "Admins can read all roles"
    ON user_roles FOR SELECT
    TO authenticated
    USING (is_admin_for_policy());

-- New admin update policy using the security definer function
CREATE POLICY "Only admins can update roles"
    ON user_roles FOR UPDATE
    TO authenticated
    USING (is_admin_for_policy());

-- Update the existing is_admin function to use the new pattern
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN is_admin_for_policy();
END;
$$ language plpgsql security definer; 