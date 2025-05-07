-- Create a new storage bucket for SQLite databases
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'sqlite-dbs',
    'sqlite-dbs',
    false,  -- not public
    false,  -- no avif autodetection needed
    52428800,  -- 50MB limit per file
    ARRAY['application/x-sqlite3', 'application/vnd.sqlite3', 'application/octet-stream']::text[]
);

-- Create storage policy to allow users to read their own databases
CREATE POLICY "Users can read their own databases"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'sqlite-dbs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Create storage policy to allow users to upload their own databases
CREATE POLICY "Users can upload their own databases"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'sqlite-dbs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Create storage policy to allow users to update their own databases
CREATE POLICY "Users can update their own databases"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'sqlite-dbs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Create storage policy to allow users to delete their own databases
CREATE POLICY "Users can delete their own databases"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'sqlite-dbs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
