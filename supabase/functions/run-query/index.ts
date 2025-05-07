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

    // Save to tmp directory first
    const tmpDbPath = `/tmp/${dbName}_${crypto.randomUUID()}.db`;
    const uint8Array = new Uint8Array(await dbFile.arrayBuffer());
    await Deno.writeFile(tmpDbPath, uint8Array);

    // Initialize SQL.js and create database from tmp file
    const SQL = await initSqlJs();
    const fileBuffer = await Deno.readFile(tmpDbPath);
    const db = new SQL.Database(fileBuffer);

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

        const isSelect = trimmedStmt.toLowerCase().startsWith('select');
        const isDDL = /^(create|alter|drop)\s+/i.test(trimmedStmt);

        if (isSelect) {
          // For SELECT queries, return the results
          const stmt = db.prepare(trimmedStmt);
          const queryResults: QueryResult[] = [];
          while (stmt.step()) {
            queryResults.push(stmt.getAsObject());
          }
          stmt.free();
          results = queryResults;
        } else {
          // For other queries (INSERT, UPDATE, DELETE, DDL), execute and get results
          try {
            db.run(trimmedStmt);
            
            // For DDL statements, verify the changes
            if (isDDL) {
              // Check if table exists after CREATE TABLE
              if (trimmedStmt.toLowerCase().includes('create table')) {
                const tableName = trimmedStmt.match(/create\s+table\s+(\w+)/i)?.[1];
                if (tableName) {
                  const tableCheck = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
                  if (tableCheck && tableCheck.length > 0 && tableCheck[0].values.length > 0) {
                    totalRowsAffected = 1; // Indicate success for DDL
                    console.log(`Table ${tableName} was created successfully`);
                  }
                }
              } else {
                totalRowsAffected = 1; // Indicate success for other DDL
              }
            } else {
              // For DML statements, get affected rows
              const changes = db.exec("SELECT changes(), last_insert_rowid()")[0];
              if (changes && changes.values[0]) {
                totalRowsAffected += changes.values[0][0] as number;
                lastInsertId = changes.values[0][1] as number;
              }
            }
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            throw new Error(`Error executing statement: ${trimmedStmt}\nError: ${errorMessage}`);
          }
        }
      }

      // Export the database to a new file in tmp
      const updatedDbContent = db.export();
      const updatedTmpPath = `/tmp/${dbName}_updated_${crypto.randomUUID()}.db`;
      await Deno.writeFile(updatedTmpPath, updatedDbContent);

      // Verify the file exists and has content
      const stats = await Deno.stat(updatedTmpPath);
      if (stats.size === 0) {
        throw new Error('Database export failed - got empty file');
      }

      // Read the file back and upload to storage
      const finalContent = await Deno.readFile(updatedTmpPath);
      
      // Upload the modified database back to storage
      const { error: uploadError } = await supabaseClient
        .storage
        .from('sqlite-dbs')
        .upload(storagePath, finalContent, {
          contentType: 'application/x-sqlite3',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Error uploading database: ${uploadError.message}`);
      }

      // Clean up tmp files
      try {
        await Deno.remove(tmpDbPath);
        await Deno.remove(updatedTmpPath);
      } catch (e) {
        console.error('Error cleaning up tmp files:', e);
      }

      // Update database record with new size
      await supabaseClient
        .from('databases')
        .update({
          storage_size_bytes: finalContent.length,
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