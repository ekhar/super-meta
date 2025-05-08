// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { default as initSqlJs } from "npm:sql.js@1.9.0"
import { corsHeaders } from '../_shared/cors.ts'
import { trackMetrics, getStringSizeInBytes, getObjectSizeInBytes } from "../_shared/metrics.ts"

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
  storage_size_bytes: number
  created_at: string
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
      .select('database_id, owner_id')
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
      .select('id, name, owner_id, storage_size_bytes, created_at')
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

    // Track download metrics
    const downloadSize = dbFile.size
    await trackMetrics(supabase, slugData.owner_id, {
      readBytes: downloadSize,
      egressBytes: downloadSize
    })

    // For GET requests, return database info
    if (req.method === 'GET') {
      const info = {
        name: dbRecord.name,
        size: dbRecord.storage_size_bytes,
        created_at: dbRecord.created_at
      }
      
      // Track GET request metrics
      await trackMetrics(supabase, slugData.owner_id, {
        readBytes: getObjectSizeInBytes(info),
        egressBytes: getObjectSizeInBytes(info)
      })

      return new Response(
        JSON.stringify(info),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For POST requests, execute query
    if (req.method === 'POST') {
      const requestData: QueryRequest = await req.json()
      if (!requestData.sql) {
        return new Response(
          JSON.stringify({ error: 'SQL query is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Save to tmp directory
      const tmpDbPath = `/tmp/${dbRecord.name}_${crypto.randomUUID()}.db`
      const uint8Array = new Uint8Array(await dbFile.arrayBuffer())
      await Deno.writeFile(tmpDbPath, uint8Array)

      // Initialize SQL.js
      const SQL = await initSqlJs()
      const fileBuffer = await Deno.readFile(tmpDbPath)
      const db = new SQL.Database(fileBuffer)

      try {
        // Split and execute statements
        const statements = splitSqlStatements(requestData.sql)
        let totalReadBytes = 0
        let totalWriteBytes = 0
        let allResults: { query: string; results: QueryResult[] }[] = []

        for (const statement of statements) {
          const trimmedStmt = statement.trim()
          if (!trimmedStmt) continue

          const isSelect = trimmedStmt.toLowerCase().startsWith('select')
          const isDDL = /^(create|alter|drop)\s+/i.test(trimmedStmt)
          const isWrite = !isSelect || isDDL

          // Track statement size
          const statementSize = getStringSizeInBytes(trimmedStmt)
          if (isWrite) {
            totalWriteBytes += statementSize
          }

          if (isSelect) {
            const stmt = db.prepare(trimmedStmt)
            const queryResults: QueryResult[] = []
            
            while (stmt.step()) {
              const result = stmt.getAsObject()
              queryResults.push(result)
              totalReadBytes += getObjectSizeInBytes(result)
            }
            
            stmt.free()
            allResults.push({ query: trimmedStmt, results: queryResults })
          } else {
            db.run(trimmedStmt)
            allResults.push({ query: trimmedStmt, results: [] })
          }
        }

        // Get final database state
        const exportData = db.export()
        const finalDbSize = exportData.length

        // Upload if there were writes
        if (totalWriteBytes > 0) {
          const { error: uploadError } = await supabase
            .storage
            .from('sqlite-dbs')
            .upload(storagePath, exportData, {
              upsert: true,
              contentType: 'application/x-sqlite3'
            })

          if (uploadError) {
            throw new Error(`Error uploading database: ${uploadError.message}`)
          }

          // Track upload metrics
          await trackMetrics(supabase, slugData.owner_id, {
            writeBytes: finalDbSize
          })
        }

        // Track query metrics
        await trackMetrics(supabase, slugData.owner_id, {
          readBytes: totalReadBytes,
          writeBytes: totalWriteBytes,
          egressBytes: getObjectSizeInBytes(allResults)
        })

        // Clean up
        db.close()
        await Deno.remove(tmpDbPath)

        return new Response(
          JSON.stringify({ results: allResults }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        // Clean up on error
        db.close()
        await Deno.remove(tmpDbPath)
        throw error
      }
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
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
