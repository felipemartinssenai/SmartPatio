
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';

const supabaseUrl = 'https://krngwlcmopsxvxzotqgp.supabase.co';
// This is a public, anonymous key. RLS policies will protect the data.
const supabaseAnonKey = 'sb_publishable_400q6PgVZfw8GlXR7By1aw__wsh3UXx';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      // This acts as a cache-buster.
      // A more robust random value is used here to ensure the schema is
      // re-fetched on every single page load, preventing cache issues.
      'X-Client-Version': `patiolog-v${crypto.randomUUID()}`,
    },
  },
});
