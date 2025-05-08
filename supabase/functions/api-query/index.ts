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
    // Parse the URL to get the slug if present
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const slug = pathParts[pathParts.length - 1]

    // Get API key from Authorization header or query param
    let apiKey: string | undefined = req.headers.get('Authorization')?.replace('Bearer ', '') || undefined
    if (!apiKey && url.searchParams.has('key')) {
      apiKey = url.searchParams.get('key') || undefined
    }

    if (!apiKey && !slug) {
      return new Response(
        JSON.stringify({ error: 'Missing API key or database slug' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let databaseId: string | null = null

    if (slug) {
      // Look up the database ID using the slug
      const { data: slugData, error: slugError } = await supabase
        .from('api_keys')
        .select('database_id')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle()

      if (slugError || !slugData) {
        return new Response(
          JSON.stringify({ error: `Invalid database URL: ${slug}` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      databaseId = slugData.database_id
    } else if (apiKey) {
      // Verify API key and get database ID
      const { data, error: verifyError } = await supabase
        .rpc('verify_api_key', { 
          api_key: apiKey,
          required_permission: req.method === 'POST' ? 'write' : 'read'
        })
        .single<ApiKeyResponse>()

      if (verifyError || !data?.database_id) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      databaseId = data.database_id
    }

    if (!databaseId) {
      return new Response(
        JSON.stringify({ error: 'Could not determine database ID' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get database record to get owner_id and name
    const { data: dbRecord, error: dbError } = await supabase
      .from('databases')
      .select('id, name, owner_id')
      .eq('id', databaseId)
      .single<DatabaseRecord>()

    if (dbError || !dbRecord) {
      return new Response(
        JSON.stringify({ error: 'Database not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the database file from storage using owner_id/name.db pattern
    const storagePath = `${dbRecord.owner_id}/${dbRecord.name}.db`
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
