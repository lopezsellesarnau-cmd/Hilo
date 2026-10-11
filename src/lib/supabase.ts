import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing Supabase env vars. Copy .env.example to .env and fill it in.');
}

/**
 * The anon key is public by design: it ships inside the app.
 * What protects the data is Row Level Security on every table.
 * Secrets (ElevenLabs, LLM, service_role) only live in Supabase Edge Functions.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
