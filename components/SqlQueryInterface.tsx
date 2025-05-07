'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { createClient } from '@/utils/supabase/client'

interface SqlQueryInterfaceProps {
  dbName: string
  onQueryComplete?: () => void
}

interface QueryResult {
  rowsAffected?: number
  lastInsertId?: number
  [key: string]: any
}

export default function SqlQueryInterface({ dbName, onQueryComplete }: SqlQueryInterfaceProps) {
  const [sql, setSql] = useState('')
  const [results, setResults] = useState<QueryResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const supabase = createClient()

  const handleRunQuery = async () => {
    if (!sql.trim()) {
      setError('Please enter a SQL query')
      return
    }

    setIsLoading(true)
    setError(null)
    setResults(null)

    try {
      // Get session for auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('http://127.0.0.1:54321/functions/v1/run-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          dbName,
          sql,
          params: []
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run query')
      }

      setResults(Array.isArray(data.data) ? data.data : [data.data])
      
      // Call the onQueryComplete callback after successful query execution
      if (onQueryComplete) {
        onQueryComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Run query on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleRunQuery()
    }
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Query Database: {dbName}</h2>
        <button
          onClick={handleRunQuery}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {isLoading ? 'Running...' : 'Run Query (⌘/Ctrl + Enter)'}
        </button>
      </div>

      <div className="h-64 border rounded-lg overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={(value: string | undefined) => setSql(value || '')}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            quickSuggestions: true,
            wordWrap: 'on'
          }}
        />
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {results && (
        <div className="overflow-x-auto">
          <table className="w-full bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {Object.keys(results[0] || {}).map((key) => (
                  <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {results.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((value: any, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
} 