
import { createClient } from '@supabase/supabase-js';

// Read the Supabase credentials from the environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Stop the application from silently running without credentials.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase credentials are missing. Check your .env.local file.'
  );
}

// Create one reusable Supabase client for the entire application.
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
