import { SupabaseClient } from 'npm:@supabase/supabase-js'

export interface MetricsData {
  readBytes?: number
  writeBytes?: number
  egressBytes?: number
}

export async function trackMetrics(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  metrics: MetricsData
) {
  try {
    await supabase.rpc('record_api_metrics', {
      p_user_id: userId,
      p_read_bytes: metrics.readBytes || 0,
      p_write_bytes: metrics.writeBytes || 0,
      p_egress_bytes: metrics.egressBytes || 0
    })
  } catch (error) {
    console.error('Failed to track metrics:', error)
  }
}

// Helper to calculate string size in bytes
export function getStringSizeInBytes(str: string): number {
  return new TextEncoder().encode(str).length
}

// Helper to calculate object size in bytes
export function getObjectSizeInBytes(obj: any): number {
  const str = JSON.stringify(obj)
  return getStringSizeInBytes(str)
}

// Helper to track query metrics
export async function trackQueryMetrics(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  query: string,
  result: any
) {
  const querySize = getStringSizeInBytes(query)
  const resultSize = getObjectSizeInBytes(result)

  await trackMetrics(supabase, userId, {
    readBytes: resultSize,
    writeBytes: querySize,
    egressBytes: resultSize // The result will be sent back to the client
  })
} 