function getEnv(name, { optional = false, defaultValue } = {}) {
  const v = process.env[name];
  if ((v === undefined || v === '') && defaultValue !== undefined) return defaultValue;
  if (!v && !optional) throw new Error(`Missing env var: ${name}`);
  return v;
}

function loadEnv() {
  const rawPort = process.env.PORT;
  const parsedPort = rawPort === undefined || rawPort === '' ? NaN : Number.parseInt(String(rawPort), 10);
  const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4000;

  const CLIENT_URL = getEnv('CLIENT_URL', { defaultValue: 'http://localhost:5173' });
  const JWT_SECRET = getEnv('JWT_SECRET', { defaultValue: 'dev-only-change-JWT_SECRET-in-production' });
  const JWT_EXPIRES_IN = getEnv('JWT_EXPIRES_IN', { defaultValue: '8h' });

  // Allow server to boot for local dev; DB calls will fail until real keys are set.
  const SUPABASE_URL = getEnv('SUPABASE_URL', { defaultValue: '' });
  const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_KEY', { defaultValue: '' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      '[HireBlind] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — API routes that hit the DB will fail. Copy server/.env.example to server/.env and fill in Supabase credentials.',
    );
  }

  return {
    PORT,
    CLIENT_URL,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    SUPABASE_URL: SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY || 'placeholder-service-role-key',
    ANTHROPIC_API_KEY: getEnv('ANTHROPIC_API_KEY', { optional: true }),
    _supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY),
  };
}

module.exports = { loadEnv };

