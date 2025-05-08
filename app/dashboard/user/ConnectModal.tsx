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

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const getApiUrl = () => {
    if (!apiKeys) return ''
    return `${projectUrl}/functions/v1/api-query/${apiKeys.write_slug}`
  }

  const getCurlCommand = () => {
    if (!apiKeys) return ''
    return `curl -X POST '${getApiUrl()}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${apiKeys.write_key}' \\
  -d '{
    "sql": "INSERT INTO your_table (column1, column2) VALUES ($1, $2)",
    "params": ["value1", "value2"]
  }'`
  }

  const getFetchCommand = () => {
    if (!apiKeys) return ''
    return `const response = await fetch('${getApiUrl()}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKeys.write_key}'
  },
  body: JSON.stringify({
    sql: 'INSERT INTO your_table (column1, column2) VALUES ($1, $2)',
    params: ['value1', 'value2']
  })
})`
  }

  const getAxiosCommand = () => {
    if (!apiKeys) return ''
    return `const response = await axios.post('${getApiUrl()}', {
  sql: 'INSERT INTO your_table (column1, column2) VALUES ($1, $2)',
  params: ['value1', 'value2']
}, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${apiKeys.write_key}'
  }
})`
  }

  const CopyButton = ({ text, fieldId }: { text: string; fieldId: string }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => copyToClipboard(text, fieldId)}
    >
      {copiedField === fieldId ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </Button>
  )

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
            <div className="space-y-6">
              {/* API URL Section */}
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">API URL</h3>
                    <CopyButton text={getApiUrl()} fieldId="api-url" />
                  </div>
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                    {getApiUrl()}
                  </pre>
                </div>
              </Card>

              {/* API Key Section */}
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">API Key</h3>
                    <CopyButton text={apiKeys.write_key} fieldId="api-key" />
                  </div>
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                    {apiKeys.write_key}
                  </pre>
                </div>
              </Card>

              {/* Code Examples Section */}
              <Card className="p-4">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Code Examples</h3>

                  {/* cURL Example */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">cURL</p>
                      <CopyButton text={getCurlCommand()} fieldId="curl" />
                    </div>
                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                      {getCurlCommand()}
                    </pre>
                  </div>

                  {/* Fetch Example */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">JavaScript (Fetch)</p>
                      <CopyButton text={getFetchCommand()} fieldId="fetch" />
                    </div>
                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                      {getFetchCommand()}
                    </pre>
                  </div>

                  {/* Axios Example */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">JavaScript (Axios)</p>
                      <CopyButton text={getAxiosCommand()} fieldId="axios" />
                    </div>
                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                      {getAxiosCommand()}
                    </pre>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 