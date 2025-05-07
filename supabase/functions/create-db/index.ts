import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { default as initSqlJs } from "npm:sql.js@1.9.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDBRequest {
  name: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Get request body
    const { name }: CreateDBRequest = await req.json();
    if (!name) {
      throw new Error('Name is required');
    }

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Get user data
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Error getting user');
    }

    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // Create a new empty database
    const db = new SQL.Database();

    // Create schema version table and set initial version
    db.run(`
      CREATE TABLE _schema_version (
        version INTEGER PRIMARY KEY,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO _schema_version (version) VALUES (1);
    `);

    // Export the database to a Uint8Array
    const dbContent = db.export();

    // Clean up the database instance
    db.close();

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${name}.db`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from('sqlite-dbs')
      .upload(storagePath, dbContent, {
        contentType: 'application/x-sqlite3',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Error uploading database: ${uploadError.message}`);
    }

    // Create database record in metadata table
    const { data: dbRecord, error: dbError } = await supabaseClient
      .from('databases')
      .insert({
        name,
        owner_id: user.id,
        storage_size_bytes: dbContent.length
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Error creating database record: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify(dbRecord),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
}); 