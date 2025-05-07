import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CopyIcon, CheckIcon } from '@radix-ui/react-icons'
import { toast } from 'sonner'

interface ApiKeys {
  read_key: string
  write_key: string
  read_slug: string
  write_slug: string
}

interface DatabaseApiKeysProps {
  databaseId: string
  projectUrl: string
}

export function DatabaseApiKeys({ databaseId, projectUrl }: DatabaseApiKeysProps) {
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
        toast.error('Failed to fetch API keys')
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
      toast.success('Copied to clipboard')
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  if (loading) {
    return <div>Loading API keys...</div>
  }

  if (!apiKeys) {
    return (
      <div className="text-center py-4 text-gray-500">
        No API keys found for this database
      </div>
    )
  }

  const apiBaseUrl = `${projectUrl}/functions/v1/api-query`

  const connectionInfo = [
    {
      title: 'Read-Only Access',
      key: apiKeys.read_key,
      slug: apiKeys.read_slug,
      description: 'Use this key for read-only operations',
      url: `${apiBaseUrl}/${apiKeys.read_slug}`
    },
    {
      title: 'Read-Write Access',
      key: apiKeys.write_key,
      slug: apiKeys.write_slug,
      description: 'Use this key for full database access',
      url: `${apiBaseUrl}/${apiKeys.write_slug}`
    }
  ]

  return (
    <div className="space-y-6">
      {connectionInfo.map((info) => (
        <div key={info.title} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">{info.title}</h3>
              <p className="text-sm text-muted-foreground">{info.description}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">API URL</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={info.url}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(info.url, `${info.title}-url`)}
                >
                  {copiedField === `${info.title}-url` ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Slug</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={info.slug}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(info.slug, `${info.title}-slug`)}
                >
                  {copiedField === `${info.title}-slug` ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="space-y-3">
        <h3 className="font-semibold text-lg">Quick Start</h3>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Using fetch:</p>
          <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-sm">
            {`fetch('${apiBaseUrl}/${apiKeys.read_slug}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sql: 'SELECT * FROM your_table',
    params: []
  })
})`}
          </pre>
        </div>
      </div>
    </div>
  )
} 