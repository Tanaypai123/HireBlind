const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'recruiter']),
});

function authRoutes({ supabase, jwtSecret, jwtExpiresIn, auth, requireRole }) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const { data: user, error } = await supabase
      .from('users')
      .select('id,email,password_hash,role')
      .eq('email', email)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });
    return res.json({ token });
  });

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    // Bootstrap mode: if there are no users yet, allow first admin creation without JWT.
    const { count, error: countErr } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (countErr) return res.status(500).json({ error: 'Database error' });
    const isBootstrap = (count || 0) === 0;

    if (!isBootstrap) {
      // Admin-only after bootstrap
      // auth is expected to be mounted before this route group when needed
      if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    } else {
      if (parsed.data.role !== 'admin') {
        return res.status(400).json({ error: 'First user must be admin (bootstrap)' });
      }
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password, role } = parsed.data;
    const password_hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from('users')
      .insert({ email, password_hash, role })
      .select('id,email,role,created_at')
      .single();
    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate')) {
        return res.status(409).json({ error: 'Email already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }

    return res.status(201).json({ user: data });
  });

  router.get('/me', auth, async (req, res) => {
    return res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } });
  });

  return router;
}

module.exports = { authRoutes };

