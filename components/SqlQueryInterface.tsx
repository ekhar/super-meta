'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { createClient } from '@/utils/supabase/client'
import { getFunctionsUrl } from '@/utils/functions'

interface QueryResult {
  query: string;
  results: Record<string, any>[];
  rowsAffected?: number;
  lastInsertId?: number | null;
}

interface SqlQueryInterfaceProps {
  dbName: string;
  onQueryComplete?: () => void;
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

      const response = await fetch(getFunctionsUrl('run-query'), {
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

      setResults(data.results || [])
      
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
        <div className="space-y-4">
          {results.map((result, resultIndex) => (
            <div key={resultIndex} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Query metadata section */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <div className="text-sm text-gray-500 dark:text-gray-300 font-mono">{result.query}</div>
                <div className="mt-2 flex gap-4 text-sm">
                  {typeof result.rowsAffected === 'number' && result.rowsAffected > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      {result.rowsAffected} row{result.rowsAffected !== 1 ? 's' : ''} affected
                    </span>
                  )}
                  {result.lastInsertId !== null && (
                    <span className="text-blue-600 dark:text-blue-400">
                      Last insert ID: {result.lastInsertId}
                    </span>
                  )}
                </div>
              </div>

              {/* Results table section */}
              {result.results && result.results.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {Object.keys(result.results[0]).map((key) => (
                          <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {result.results.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          {Object.values(row).map((value: any, colIndex) => (
                            <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {value === null ? (
                                <span className="text-gray-400 dark:text-gray-500 italic">NULL</span>
                              ) : typeof value === 'object' ? (
                                <pre className="font-mono text-xs">{JSON.stringify(value, null, 2)}</pre>
                              ) : String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                      <tr>
                        <td colSpan={Object.keys(result.results[0]).length} className="px-6 py-3 text-sm text-gray-500 dark:text-gray-300">
                          {result.results.length} row{result.results.length !== 1 ? 's' : ''} returned
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 