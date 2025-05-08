import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CopyIcon, CheckIcon } from '@radix-ui/react-icons'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  const getReadCurlCommand = () => {
    if (!apiKeys) return ''
    const apiBaseUrl = `${projectUrl}/functions/v1/api-query/${apiKeys.read_slug}`
    return `curl -X GET '${apiBaseUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${apiKeys.read_key}' \\
  -d '{
    "sql": "SELECT * FROM your_table",
    "params": []
  }'`
  }

  const getWriteCurlCommand = () => {
    if (!apiKeys) return ''
    const apiBaseUrl = `${projectUrl}/functions/v1/api-query/${apiKeys.write_slug}`
    return `curl -X POST '${apiBaseUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ${apiKeys.write_key}' \\
  -d '{
    "sql": "INSERT INTO your_table (column1, column2) VALUES ($1, $2)",
    "params": ["value1", "value2"]
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
            <Tabs defaultValue="read" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="read">Read-Only Access</TabsTrigger>
                <TabsTrigger value="write">Read-Write Access</TabsTrigger>
              </TabsList>
              <TabsContent value="read">
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-lg">Read-Only API Key</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(apiKeys.read_key, 'read-key')}
                      >
                        {copiedField === 'read-key' ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                      {apiKeys.read_key}
                    </pre>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">Example Query:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(getReadCurlCommand(), 'read-curl')}
                        >
                          {copiedField === 'read-curl' ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                        {getReadCurlCommand()}
                      </pre>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              <TabsContent value="write">
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-lg">Read-Write API Key</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(apiKeys.write_key, 'write-key')}
                      >
                        {copiedField === 'write-key' ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                      {apiKeys.write_key}
                    </pre>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">Example Query:</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(getWriteCurlCommand(), 'write-curl')}
                        >
                          {copiedField === 'write-curl' ? (
                            <CheckIcon className="h-4 w-4" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
                        {getWriteCurlCommand()}
                      </pre>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 