import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CopyIcon, CheckIcon } from '@radix-ui/react-icons'

interface ConnectModalProps {
  isOpen: boolean
  onClose: () => void
  databaseId: string
  projectUrl: string
}

interface ApiKeys {
  read_key: string
  write_key: string
  read_slug: string
  write_slug: string
}

export function ConnectModal({ isOpen, onClose, databaseId, projectUrl }: ConnectModalProps) {
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchApiKeys() {
      try {
        const { data, error } = await supabase
          .rpc('get_api_keys', { p_database_id: databaseId })
          .single()

        if (error) throw error
        if (data) {
          setApiKeys(data as ApiKeys)
        }
      } catch (error) {
        console.error('Error fetching API keys:', error)
      } finally {
        setLoading(false)
      }
    }

    if (databaseId) {
      fetchApiKeys()
    }
  }, [databaseId])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField('curl')
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const getCurlCommand = () => {
    if (!apiKeys) return ''
    const apiBaseUrl = `${projectUrl}/functions/v1/api-query`
    return `curl -X POST '${apiBaseUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${apiKeys.read_key}' \\
  -d '{
    "sql": "SELECT * FROM your_table",
    "params": []
  }'`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4 mb-4 border-b">
          <DialogTitle>Connect to Database</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : !apiKeys ? (
            <div className="text-center py-4 text-gray-500">
              No API keys found for this database
            </div>
          ) : (
            <Card className="p-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Quick Start</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Using curl:</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getCurlCommand())}
                    >
                      {copiedField === 'curl' ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                    {getCurlCommand()}
                  </pre>
                </div>
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 