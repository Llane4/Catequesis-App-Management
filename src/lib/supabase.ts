import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url?.trim() || !anonKey?.trim()) {
  const faltan: string[] = []
  if (!url?.trim()) faltan.push('VITE_SUPABASE_URL')
  if (!anonKey?.trim()) faltan.push('VITE_SUPABASE_ANON_KEY')
  throw new Error(
    `Faltan en .env (raíz del proyecto frontend): ${faltan.join(', ')}. Tras editar .env, detén y vuelve a ejecutar "npm run dev".`,
  )
}

export const supabase = createClient(url, anonKey)
