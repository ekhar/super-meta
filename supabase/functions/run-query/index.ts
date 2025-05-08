import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { default as initSqlJs } from "npm:sql.js@1.9.0";
import { trackMetrics, getStringSizeInBytes, getObjectSizeInBytes } from "../_shared/metrics.ts";

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

// Split SQL statements while preserving quoted content and comments
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let currentStatement = '';
  let inQuote = false;
  let quoteChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    const prevChar = sql[i - 1] || '';

    // Handle start of line comment
    if (char === '-' && nextChar === '-' && !inQuote && !inBlockComment && !inLineComment) {
      inLineComment = true;
      currentStatement += char + nextChar;
      i++; // Skip next dash
      continue;
    }

    // Handle end of line comment
    if (inLineComment && (char === '\n' || i === sql.length - 1)) {
      inLineComment = false;
      currentStatement += char;
      continue;
    }

    // Handle start of block comment
    if (char === '/' && nextChar === '*' && !inQuote && !inLineComment && !inBlockComment) {
      inBlockComment = true;
      currentStatement += char + nextChar;
      i++; // Skip next asterisk
      continue;
    }

    // Handle end of block comment
    if (char === '*' && nextChar === '/' && inBlockComment) {
      inBlockComment = false;
      currentStatement += char + nextChar;
      i++; // Skip next slash
      continue;
    }

    // Handle quotes
    if ((char === "'" || char === '"') && !inLineComment && !inBlockComment) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && prevChar !== '\\') {
        inQuote = false;
      }
    }

    // Add character to current statement
    currentStatement += char;

    // Check for statement end (only if not in a quote, comment, or escaped)
    if (char === ';' && !inQuote && !inLineComment && !inBlockComment) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add the last statement if it doesn't end with a semicolon
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  // Filter out empty statements and pure comment statements
  return statements.filter(stmt => {
    const trimmed = stmt.trim();
    if (!trimmed) return false;
    
    // Remove all comments to check if there's actual SQL content
    const withoutComments = trimmed
      // Remove block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove line comments
      .replace(/--.*$/gm, '')
      .trim();
    
    return withoutComments.length > 0;
  });
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

    // Track download metrics
    const downloadSize = dbFile.size;
    await trackMetrics(supabaseClient, user.id, {
      readBytes: downloadSize,
      egressBytes: downloadSize
    });

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
      let allResults: { query: string; results: QueryResult[] }[] = [];
      let totalReadBytes = 0;
      let totalWriteBytes = 0;

      // Execute each statement
      for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (!trimmedStmt) continue;

        const isSelect = trimmedStmt.toLowerCase().startsWith('select');
        const isDDL = /^(create|alter|drop)\s+/i.test(trimmedStmt);
        const isWrite = !isSelect || isDDL;

        // Track the SQL statement size
        const statementSize = getStringSizeInBytes(trimmedStmt);
        if (isWrite) {
          totalWriteBytes += statementSize;
        }

        if (isSelect) {
          // For SELECT queries, return the results
          const stmt = db.prepare(trimmedStmt);
          const queryResults: QueryResult[] = [];
          while (stmt.step()) {
            const result = stmt.getAsObject();
            queryResults.push(result);
            totalReadBytes += getObjectSizeInBytes(result);
          }
          stmt.free();
          allResults.push({ query: trimmedStmt, results: queryResults });
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
          } catch (error) {
            console.error(`Error executing statement: ${error}`);
            throw error;
          }
        }
      }

      // Get the final database state
      const exportData = db.export();
      const finalDbSize = exportData.length;

      // Write back to storage if there were any write operations
      if (totalWriteBytes > 0) {
        const { error: uploadError } = await supabaseClient
          .storage
          .from('sqlite-dbs')
          .upload(storagePath, exportData, {
            upsert: true,
            contentType: 'application/x-sqlite3'
          });

        if (uploadError) {
          throw new Error(`Error uploading database: ${uploadError.message}`);
        }

        // Track upload metrics
        await trackMetrics(supabaseClient, user.id, {
          writeBytes: finalDbSize
        });
      }

      // Track query metrics
      await trackMetrics(supabaseClient, user.id, {
        readBytes: totalReadBytes,
        writeBytes: totalWriteBytes,
        egressBytes: getObjectSizeInBytes(allResults)
      });

      // Clean up
      db.close();
      await Deno.remove(tmpDbPath);

      // Return results
      return new Response(
        JSON.stringify({
          results: allResults,
          rowsAffected: totalRowsAffected,
          lastInsertId
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      // Clean up on error
      db.close();
      await Deno.remove(tmpDbPath);
      throw error;
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}); 