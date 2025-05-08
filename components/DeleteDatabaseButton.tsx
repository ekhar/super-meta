'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getFunctionsUrl } from '@/utils/functions'

interface DeleteDatabaseButtonProps {
  dbName: string
  onDelete: () => void
}

export default function DeleteDatabaseButton({ dbName, onDelete }: DeleteDatabaseButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const supabase = createClient()

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(getFunctionsUrl('delete-db'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: dbName }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete database')
      }

      onDelete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200"
        disabled={isLoading}
      >
        Delete
      </button>

      {showConfirm && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40"
            onClick={() => {
              if (!isLoading) {
                setShowConfirm(false)
                setError(null)
              }
            }}
          />
          
          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Delete Database
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <p className="break-words">
                  Are you sure you want to delete <span className="font-medium break-all">"{dbName}"</span>?
                </p>
                <p className="mt-1">
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowConfirm(false)
                    setError(null)
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    isLoading
                      ? 'bg-red-100 text-red-400 dark:bg-red-900/30 dark:text-red-300 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete Database'
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md break-words">
                  {error}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
} 