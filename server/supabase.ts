import { createClient } from '@supabase/supabase-js';

// Supabase client for direct operations (if needed in the future)
// Currently using direct PostgreSQL connection with Drizzle ORM for better type safety

let supabase: ReturnType<typeof createClient> | null = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

export { supabase };