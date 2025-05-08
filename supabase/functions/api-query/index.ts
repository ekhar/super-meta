// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { default as initSqlJs } from "npm:sql.js@1.9.0"
import { corsHeaders } from '../_shared/cors.ts'

interface QueryRequest {
  sql: string
  params?: any[]
}

interface ApiKeyResponse {
  database_id: string
}

interface QueryResult {
  [key: string]: unknown
}

interface DatabaseRecord {
  id: string
  name: string
  owner_id: string
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

console.log("Hello from Functions!")

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the URL to get the slug
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const slug = pathParts[pathParts.length - 1]
    console.log('Received request for slug:', slug)

    // Get API key from Authorization header
    const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '')
    console.log('Using API key:', apiKey)

    // Both slug and API key are required
    if (!apiKey || !slug) {
      console.log('Missing required fields:', { apiKey: !!apiKey, slug: !!slug })
      return new Response(
        JSON.stringify({ 
          error: 'Both database slug and bearer token are required',
          details: {
            slug: slug ? 'provided' : 'missing',
            bearer_token: apiKey ? 'provided' : 'missing'
          }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    console.log('Supabase URL:', supabaseUrl)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Look up the database ID using the slug
    const { data: slugData, error: slugError } = await supabase
      .from('api_keys')
      .select('database_id')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    console.log('Slug lookup result:', { slugData, slugError })

    if (slugError || !slugData) {
      return new Response(
        JSON.stringify({ error: `Invalid database URL: ${slug}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify API key and check permissions
    console.log('Verifying API key with permission:', req.method === 'POST' ? 'write' : 'read')
    const { data: keyData, error: verifyError } = await supabase
      .rpc('verify_api_key', { 
        api_key: apiKey,
        required_permission: req.method === 'POST' ? 'write' : 'read'
      })
      .single<ApiKeyResponse>()

    console.log('API key verification result:', { keyData, verifyError })

    if (verifyError || !keyData?.database_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid API key',
          details: verifyError ? verifyError.message : 'No database ID returned'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify that the slug and API key are for the same database
    console.log('Comparing database IDs:', { 
      fromSlug: slugData.database_id, 
      fromKey: keyData.database_id 
    })
    
    if (slugData.database_id !== keyData.database_id) {
      return new Response(
        JSON.stringify({ error: 'API key does not match database slug' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const databaseId = slugData.database_id

    // Get database record to get owner_id and name
    const { data: dbRecord, error: dbError } = await supabase
      .from('databases')
      .select('id, name, owner_id')
      .eq('id', databaseId)
      .single<DatabaseRecord>()

    console.log('Database record lookup:', { dbRecord, dbError })

    if (dbError || !dbRecord) {
      return new Response(
        JSON.stringify({ error: 'Database not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the database file from storage using owner_id/name.db pattern
    const storagePath = `${dbRecord.owner_id}/${dbRecord.name}.db`
    console.log('Attempting to download from storage:', storagePath)
    const { data: dbFile, error: storageError } = await supabase
      .storage
      .from('sqlite-dbs')
      .download(storagePath)

    if (storageError) {
      return new Response(
        JSON.stringify({ error: 'Database file not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save to tmp directory first
    const tmpDbPath = `/tmp/${dbRecord.name}_${crypto.randomUUID()}.db`
    const uint8Array = new Uint8Array(await dbFile.arrayBuffer())
    await Deno.writeFile(tmpDbPath, uint8Array)

    // Parse request body
    const { sql, params = [] }: QueryRequest = await req.json()
    if (!sql) {
      return new Response(
        JSON.stringify({ error: 'Missing SQL query' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Executing SQL query:', { sql, params })

    // Initialize SQL.js and create database from tmp file
    const SQL = await initSqlJs()
    const fileBuffer = await Deno.readFile(tmpDbPath)
    const db = new SQL.Database(fileBuffer)

    try {
      // Split the SQL into separate statements
      const statements = splitSqlStatements(sql)
      let totalRowsAffected = 0
      let lastInsertId: number | null = null
      let allResults: { query: string; results: QueryResult[] }[] = []

      // Execute each statement
      for (const statement of statements) {
        const trimmedStmt = statement.trim()
        if (!trimmedStmt) continue

        const isSelect = trimmedStmt.toLowerCase().startsWith('select')
        const isDDL = /^(create|alter|drop)\s+/i.test(trimmedStmt)

        if (isSelect) {
          // For SELECT queries, return the results
          const stmt = db.prepare(trimmedStmt)
          if (params && params.length > 0) {
            stmt.bind(params)
          }
          const queryResults: QueryResult[] = []
          while (stmt.step()) {
            queryResults.push(stmt.getAsObject())
          }
          stmt.free()
          allResults.push({ query: trimmedStmt, results: queryResults })
        } else {
          // For other queries (INSERT, UPDATE, DELETE, DDL), execute and get results
          try {
            // Special handling for CREATE TABLE IF NOT EXISTS
            if (trimmedStmt.toLowerCase().includes('create table if not exists')) {
              // Extract table name and schema
              const match = trimmedStmt.match(/create\s+table\s+if\s+not\s+exists\s+(\w+)\s*\((.*)\)/i)
              if (match) {
                const [, tableName, schema] = match
                // Check if table exists
                try {
                  const checkStmt = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
                  checkStmt.bind([tableName])
                  const exists = checkStmt.step()
                  checkStmt.free()
                  
                  if (!exists) {
                    // Table doesn't exist, create it
                    const createStmt = `CREATE TABLE ${tableName} (${schema})`
                    db.run(createStmt)
                  }
                } catch (e: unknown) {
                  throw new Error(`Error checking/creating table ${tableName}: ${e instanceof Error ? e.message : String(e)}`)
                }
              } else {
                throw new Error('Invalid CREATE TABLE IF NOT EXISTS syntax')
              }
            } else {
              // Normal execution for other statements with parameter binding
              const stmt = db.prepare(trimmedStmt)
              if (params && params.length > 0) {
                stmt.bind(params)
              }
              while (stmt.step()) {} // Execute the statement
              stmt.free()
            }
            
            // For DDL statements, verify the changes
            if (isDDL) {
              // Check if table exists after CREATE TABLE
              if (trimmedStmt.toLowerCase().includes('create table')) {
                const tableName = trimmedStmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/i)?.[1]
                if (tableName) {
                  try {
                    const verifyStmt = db.prepare(`SELECT * FROM ${tableName} LIMIT 0`)
                    verifyStmt.free()
                  } catch (e: unknown) {
                    throw new Error(`Failed to create table ${tableName}: ${e instanceof Error ? e.message : String(e)}`)
                  }
                }
              }
            } else {
              // For DML statements, get affected rows and last insert id
              totalRowsAffected += db.getRowsModified()
              const changes = db.exec('SELECT last_insert_rowid() as last_id')
              if (changes.length > 0 && changes[0].values.length > 0) {
                lastInsertId = changes[0].values[0][0] as number
              }
            }
          } catch (error: unknown) {
            throw new Error(`Error executing statement "${trimmedStmt}": ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }

      // Save changes back to storage if any modifications were made
      if (totalRowsAffected > 0 || statements.some(s => /^(create|alter|drop)\s+/i.test(s.trim()))) {
        const data = db.export()
        await Deno.writeFile(tmpDbPath, data)
        
        const file = await Deno.readFile(tmpDbPath)
        const { error: uploadError } = await supabase
          .storage
          .from('sqlite-dbs')
          .upload(storagePath, file, {
            upsert: true,
            contentType: 'application/x-sqlite3'
          })

        if (uploadError) {
          throw new Error(`Failed to save changes: ${uploadError.message}`)
        }
      }

      // Return results
      return new Response(
        JSON.stringify({
          results: allResults,
          rowsAffected: totalRowsAffected,
          lastInsertId: lastInsertId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } finally {
      db.close()
      // Clean up temporary file
      try {
        await Deno.remove(tmpDbPath)
      } catch (e) {
        console.error('Failed to clean up temporary file:', e)
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/api-query' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
