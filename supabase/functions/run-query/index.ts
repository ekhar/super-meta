import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { default as initSqlJs } from "npm:sql.js@1.9.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RunQueryRequest {
  dbName: string;
  sql: string;
  params?: unknown[];
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
    const { dbName, sql, params = [] }: RunQueryRequest = await req.json();
    if (!dbName || !sql) {
      throw new Error('Database name and SQL query are required');
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

    // Download the database file from storage
    const storagePath = `${user.id}/${dbName}.db`;
    const { data: dbFile, error: downloadError } = await supabaseClient
      .storage
      .from('sqlite-dbs')
      .download(storagePath);

    if (downloadError) {
      throw new Error(`Error downloading database: ${downloadError.message}`);
    }

    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // Create a database instance and load the file content
    const uint8Array = new Uint8Array(await dbFile.arrayBuffer());
    const db = new SQL.Database(uint8Array);

    try {
      // Execute query and get results
      let results;
      if (sql.trim().toLowerCase().startsWith('select')) {
        // For SELECT queries, return the results
        const stmt = db.prepare(sql);
        results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
      } else {
        // For other queries (INSERT, UPDATE, DELETE), execute and return affected rows
        db.run(sql, params);
        results = { 
          rowsAffected: db.getRowsModified(),
          lastInsertId: null // sql.js doesn't provide last insert id
        };
      }

      // Get the modified database content
      const updatedDbContent = db.export();

      // Upload the modified database back to storage
      const { error: uploadError } = await supabaseClient
        .storage
        .from('sqlite-dbs')
        .upload(storagePath, updatedDbContent, {
          contentType: 'application/x-sqlite3',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Error uploading database: ${uploadError.message}`);
      }

      // Update database record with new size
      await supabaseClient
        .from('databases')
        .update({
          storage_size_bytes: updatedDbContent.length,
          last_accessed: new Date().toISOString()
        })
        .eq('owner_id', user.id)
        .eq('name', dbName);

      return new Response(
        JSON.stringify({ data: results }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );

    } finally {
      // Clean up database instance
      db.close();
    }

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