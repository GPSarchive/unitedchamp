// app/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   )
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type DbEvent = {
    id: string
    title: string
    start: string // ISO
    end: string   // ISO
    all_day: boolean
  }