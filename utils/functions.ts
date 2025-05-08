export const getFunctionsUrl = (functionName: string): string => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }
  return `${supabaseUrl}/functions/v1/${functionName}`;
}; 