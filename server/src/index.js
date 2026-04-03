const path = require('path');
// Must load before reading process.env (path is server root, not cwd).
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');

const { loadEnv } = require('./env');
const { createSupabaseAdmin } = require('./supabase');
const { createClaudeClient, claudeAnonymise } = require('./utils/claude');
const { authMiddleware, requireRole, requireAnyRole } = require('./middleware/auth');

const { authRoutes } = require('./routes/auth');
const { resumesRoutes } = require('./routes/resumes');
const { screeningRoutes } = require('./routes/screening');
const { auditRoutes } = require('./routes/audit');
const { interviewsRoutes } = require('./routes/interviews');
const { overridesRoutes } = require('./routes/overrides');
const { ensureDemoAdmin } = require('./seedDemoUser');

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

async function main() {
  const env = loadEnv();

  const supabase = createSupabaseAdmin({
    url: env.SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  });

  await ensureDemoAdmin(supabase, log);

  const claudeClient = createClaudeClient(env.ANTHROPIC_API_KEY);

  const app = express();
  app.use(helmet());

  const corsAllowed = new Set([
    env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  const localViteRe = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (corsAllowed.has(origin)) return callback(null, true);
        if (localViteRe.test(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(pinoHttp({ logger: log }));

  const auth = authMiddleware({ jwtSecret: env.JWT_SECRET });

  app.get('/', (_req, res) => {
    res.type('text/plain').send('Server running');
  });

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'hireblind-api' }));

  app.use(
    '/api/auth',
    authRoutes({
      supabase,
      jwtSecret: env.JWT_SECRET,
      jwtExpiresIn: env.JWT_EXPIRES_IN,
      auth,
      requireRole,
    }),
  );

  app.use(
    '/api/resumes',
    resumesRoutes({
      supabase,
      auth,
      requireRole,
      requireAnyRole,
      claudeClient,
      claudeAnonymise,
    }),
  );

  app.use(
    '/api/overrides',
    overridesRoutes({
      supabase,
      auth,
      requireAnyRole,
    }),
  );

  app.use(
    '/api/screening',
    screeningRoutes({
      supabase,
      auth,
      requireRole,
      requireAnyRole,
      claudeClient,
    }),
  );

  app.use(
    '/api/audit',
    auditRoutes({
      supabase,
      auth,
      requireAnyRole,
    }),
  );

  app.use(
    '/api/interviews',
    interviewsRoutes({
      supabase,
      auth,
      requireAnyRole,
    }),
  );

  // Global error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    req.log?.error({ err }, 'Unhandled error');
    return res.status(500).json({ error: 'Internal server error' });
  });

  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(env.PORT, host, () => {
    log.info(
      {
        port: env.PORT,
        host,
        clientUrl: env.CLIENT_URL,
        supabaseConfigured: env._supabaseConfigured,
      },
      'HireBlind API listening — GET / returns "Server running"',
    );
  });

  server.on('error', (err) => {
    log.error({ err }, 'HTTP server error');
    process.exit(1);
  });
}

main().catch((e) => {
  log.error({ err: e }, 'Server failed to start');
  process.exit(1);
});

