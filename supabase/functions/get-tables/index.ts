import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { default as initSqlJs } from "npm:sql.js@1.9.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Hello from get-tables!')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Get the request body
    const { dbName } = await req.json()
    if (!dbName) {
      throw new Error('Database name is required')
    }

    // Get the auth token from the request header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Get user data to construct the storage path
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Error getting user')
    }

    // Get the SQLite database file from storage using the same path structure as create-db
    const storagePath = `${user.id}/${dbName}.db`
    const { data: fileData, error: fileError } = await supabaseClient
      .storage
      .from('sqlite-dbs')
      .download(storagePath)

    if (fileError) {
      throw new Error(`Error downloading database: ${fileError.message}`)
    }

    // Convert the file to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer()

    // Import sql.js
    const SQL = await initSqlJs()
    
    // Create a new database instance
    const db = new SQL.Database(new Uint8Array(arrayBuffer))

    // Query to get all tables
    const tables = db.exec(`
      SELECT 
        name as table_name,
        sql as create_statement
      FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
    `)

    // Handle case where no tables exist
    if (!tables.length) {
      return new Response(
        JSON.stringify({ data: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Get column information for each table
    const tableInfo = []
    for (const row of tables[0].values) {
      const tableName = row[0]
      const createStatement = row[1]
      
      const columns = db.exec(`PRAGMA table_info(${tableName})`)
      
      tableInfo.push({
        name: tableName,
        createStatement,
        columns: columns[0].values.map((col: any[]) => ({
          name: col[1],
          type: col[2],
          notNull: col[3] === 1,
          defaultValue: col[4],
          isPrimaryKey: col[5] === 1
        }))
      })
    }

    // Clean up
    db.close()

    return new Response(
      JSON.stringify({ data: tableInfo }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}) 