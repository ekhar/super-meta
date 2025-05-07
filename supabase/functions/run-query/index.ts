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

interface QueryResult {
  [key: string]: unknown;
}

// Split SQL statements while preserving quoted content
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';

    // Handle quotes
    if ((char === "'" || char === '"') && sql[i - 1] !== '\\') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
      }
    }

    // Add character to current statement
    currentStatement += char;

    // Check for statement end
    if (char === ';' && !inQuote) {
      // Skip if this is part of a comment
      if (!currentStatement.trim().startsWith('--')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
  }

  // Add the last statement if it doesn't end with a semicolon
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements.filter(stmt => stmt.length > 0 && !stmt.trim().startsWith('--'));
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
      // Split the SQL into separate statements
      const statements = splitSqlStatements(sql);
      let totalRowsAffected = 0;
      let lastInsertId: number | null = null;
      let results: QueryResult[] = [];

      // Execute each statement
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (!trimmedStmt) continue;

        if (trimmedStmt.toLowerCase().startsWith('select')) {
          // For SELECT queries, return the results
          const stmt = db.prepare(trimmedStmt);
          const queryResults: QueryResult[] = [];
          while (stmt.step()) {
            queryResults.push(stmt.getAsObject());
          }
          stmt.free();
          results = queryResults;
        } else {
          // For other queries (INSERT, UPDATE, DELETE), execute and count affected rows
          try {
            db.run(trimmedStmt);
            const changes = db.exec("SELECT changes(), last_insert_rowid()")[0];
            if (changes && changes.values[0]) {
              totalRowsAffected += changes.values[0][0] as number;
              lastInsertId = changes.values[0][1] as number;
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            throw new Error(`Error executing statement: ${trimmedStmt}\nError: ${errorMessage}`);
          }
        }
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

      // Return appropriate results
      const responseData = sql.toLowerCase().includes('select') 
        ? results 
        : { rowsAffected: totalRowsAffected, lastInsertId };

      return new Response(
        JSON.stringify({ data: responseData }),
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