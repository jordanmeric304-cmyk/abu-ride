const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    'SUPABASE_URL is missing from .env'
  );
}

if (!supabaseKey) {
  throw new Error(
    'SUPABASE_SECRET_KEY is missing from .env'
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

console.log('✅ Supabase client initialized');

module.exports = supabase;