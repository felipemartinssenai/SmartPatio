
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = 'https://krngwlcmopsxvxzotqgp.supabase.co';
const supabaseAnonKey = 'sb_publishable_400q6PgVZfw8GlXR7By1aw__wsh3UXx';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'patiolog-session-v1',
    storage: window.localStorage,
    flowType: 'pkce'
  },
  db: {
    schema: 'public',
  }
});
