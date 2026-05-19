import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

console.log("SUPA URL CHECK:", supabaseUrl);
console.log("SUPA KEY CHECK:", !!supabaseAnonKey);

let client: any = null;

try {
  if (supabaseUrl && supabaseUrl.startsWith('http')) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.warn("⚠️ Supabase URL is invalid or not provided. Please update your environment variables.");
  }
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
}

export const supabase = client;
