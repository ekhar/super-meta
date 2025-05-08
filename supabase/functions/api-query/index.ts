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

interface SqlResult {
  columns: string[]
  values: any[][]
}

interface DatabaseRecord {
  id: string
  name: string
  owner_id: string
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

    // Parse request body
    const { sql, params = [] }: QueryRequest = await req.json()
    if (!sql) {
      return new Response(
        JSON.stringify({ error: 'Missing SQL query' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Executing SQL query:', { sql, params })

    // Initialize SQL.js
    const SQL = await initSqlJs()
    const db = new SQL.Database(new Uint8Array(await dbFile.arrayBuffer()))

    // Execute query
    try {
      const results = db.exec(sql, params)
      return new Response(
        JSON.stringify({
          results: results.map((result: SqlResult) => ({
            columns: result.columns,
            values: result.values
          }))
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
