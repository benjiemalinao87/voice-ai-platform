import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// For demo purposes, create a dummy client if env vars are not provided
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Running in demo mode with mock data.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isDemo = !supabase;
