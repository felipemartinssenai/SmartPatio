
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = 'https://krngwlcmopsxvxzotqgp.supabase.co';
const supabaseAnonKey = 'sb_publishable_400q6PgVZfw8GlXR7By1aw__wsh3UXx';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'patiolog-auth-token',
    storage: window.localStorage
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Version': `patiolog-v${crypto.randomUUID()}`,
    },
  },
});
