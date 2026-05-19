import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export let supabase: any = null;

if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
  console.warn('⚠️  Supabase environment variables (SUPABASE_URL and SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY) are missing or invalid.');
} else {
  try {
    // Ensure you export the configured client
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.warn("⚠️  Supabase initialization failed:", err);
  }
}
