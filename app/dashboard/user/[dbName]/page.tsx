'use client'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SqlQueryInterface from '@/components/SqlQueryInterface'
import TablePreview from '@/components/TablePreview'
import Link from 'next/link'

export default function DatabasePage() {
  const params = useParams();
  const dbName = params.dbName as string;
  const router = useRouter();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (userError || !user) {
        router.push('/');
        return;
      }

      // Verify that this database belongs to the user
      supabase
        .from('databases')
        .select('id, name')
        .eq('owner_id', user.id)
        .eq('name', dbName)
        .single()
        .then(({ data: dbData, error: dbError }) => {
          if (dbError || !dbData) {
            router.push('/dashboard/user');
          } else {
            setIsAuthorized(true);
          }
        });
    });
  }, [dbName, router]);

  const handleQueryComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  }

  if (!isAuthorized) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
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
      
      <div className="space-y-8">
        <TablePreview dbName={dbName} refreshTrigger={refreshTrigger} />
        <SqlQueryInterface dbName={dbName} onQueryComplete={handleQueryComplete} />
      </div>
    </div>
  )
} 