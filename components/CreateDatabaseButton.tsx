'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function CreateDatabaseButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [dbName, setDbName] = useState('')
  
  const supabase = createClient()

  const handleCreate = async () => {
    if (!dbName.trim()) {
      setError('Database name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('http://127.0.0.1:54321/functions/v1/create-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: dbName }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create database')
      }

      // Reset form and show success
      setDbName('')
      setShowInput(false)
      // Force reload the page to show new database
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleCreate()
  }

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
      >
        Create New Database
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex gap-2">
        <input
          type="text"
          value={dbName}
          onChange={(e) => setDbName(e.target.value)}
          placeholder="Enter database name"
          className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {isLoading ? 'Creating...' : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowInput(false)
            setError(null)
            setDbName('')
          }}
          className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      )}
    </form>
  )
} 