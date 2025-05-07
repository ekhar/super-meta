import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SqlQueryInterface from '@/components/SqlQueryInterface'
import Link from 'next/link'

export default async function DatabasePage({ params }: { params: { dbName: string } }) {
  const { dbName } = await params;
  const supabase = await createClient();

  // Use getUser() for secure authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/')
  }

  // Verify that this database belongs to the user
  const { data: dbData, error: dbError } = await supabase
    .from('databases')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('name', dbName)
    .single()

  if (dbError || !dbData) {
    redirect('/dashboard/user')
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <Link 
          href="/dashboard/user" 
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Dashboard
        </Link>
      </div>
      <SqlQueryInterface dbName={dbName} />
    </div>
  )
} 