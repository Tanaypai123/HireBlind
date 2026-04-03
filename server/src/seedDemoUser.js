const bcrypt = require('bcryptjs');

const DEMO_EMAIL = 'admin@hireblind.local';
const DEMO_PASSWORD = 'admin12345';

/**
 * When the database has zero users, insert the demo admin so the login screen defaults work.
 * Disable with SEED_DEMO_USER=false in server/.env (recommended for production).
 */
async function ensureDemoAdmin(supabase, log) {
  if (process.env.SEED_DEMO_USER === 'false') {
    log.info('SEED_DEMO_USER=false — skipping demo admin seed');
    return;
  }

  const { count, error: countErr } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (countErr) {
    log.warn({ err: countErr }, 'Could not count users — demo admin seed skipped (check Supabase URL/key and schema)');
    return;
  }

  if ((count || 0) > 0) {
    return;
  }

  const password_hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const { error } = await supabase.from('users').insert({
    email: DEMO_EMAIL,
    password_hash,
    role: 'admin',
  });

  if (error) {
    log.warn({ err: error }, 'Demo admin seed failed');
    return;
  }

  log.info(
    { email: DEMO_EMAIL },
    'Demo admin created (empty users table). Matches login screen defaults; set SEED_DEMO_USER=false in production.',
  );
}

module.exports = { ensureDemoAdmin, DEMO_EMAIL, DEMO_PASSWORD };
