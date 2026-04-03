const { createClient } = require('@supabase/supabase-js');

function createSupabaseAdmin({ url, serviceKey }) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'hireblind-server' } },
  });
}

module.exports = { createSupabaseAdmin };

