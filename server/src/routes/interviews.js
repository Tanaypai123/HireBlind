const express = require('express');
const { z } = require('zod');
const { formatError } = require('../utils/formatError');

const postInterviewBody = z.object({
  sessionId: z.string().uuid(),
  resumeId: z.string().uuid(),
  slot: z.string().min(3),
});

function interviewsRoutes({ supabase, auth, requireAnyRole }) {
  const router = express.Router();

  /** List interviews for a session (for UI: show slots, disable re-schedule). */
  router.get('/session/:sessionId', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const sessionId = req.params.sessionId;
    const { data, error } = await supabase
      .from('interviews')
      .select('id,resume_id,slot,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      req.log?.error?.({ stage: 'fetch_interviews', sessionId, err: error.message });
      return res.status(500).json({
        error: formatError(error.message),
        stage: 'fetch_interviews',
      });
    }
    return res.json({ interviews: data || [] });
  });

  /**
   * Schedule one interview. No duplicates per (session_id, resume_id).
   * POST body: { sessionId, resumeId, slot }
   */
  router.post('/', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const parsed = postInterviewBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { sessionId, resumeId, slot } = parsed.data;

    const { data: session, error: sessErr } = await supabase
      .from('screening_sessions')
      .select('id,status')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessErr) {
      req.log?.error?.({ stage: 'validate_session', sessionId, resumeId, err: sessErr.message });
      return res.status(500).json({
        error: formatError(sessErr.message),
        stage: 'validate_session',
      });
    }
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'ranked') {
      req.log?.warn?.({
        sessionId,
        resumeId,
        slot,
        sessionStatus: session.status,
        userRole: req.user.role,
        reason: 'session_not_ranked',
      });
      return res.status(400).json({ error: 'Session must be ranked before scheduling' });
    }

    const { data: existing, error: dupErr } = await supabase
      .from('interviews')
      .select('id,slot')
      .eq('session_id', sessionId)
      .eq('resume_id', resumeId)
      .maybeSingle();

    if (dupErr) {
      req.log?.error?.({ stage: 'check_duplicate', sessionId, resumeId, err: dupErr.message });
      return res.status(500).json({
        error: formatError(dupErr.message),
        stage: 'check_duplicate',
      });
    }
    if (existing) {
      req.log?.warn?.({
        sessionId,
        resumeId,
        slot,
        existingSlot: existing.slot,
        reason: 'duplicate_interview',
      });
      return res.status(400).json({ error: 'Interview already scheduled for this candidate' });
    }

    const { data: row, error: insErr } = await supabase
      .from('interviews')
      .insert({
        session_id: sessionId,
        resume_id: resumeId,
        slot,
        created_by: String(req.user.id),
      })
      .select('id,session_id,resume_id,slot,created_at')
      .single();

    if (insErr) {
      req.log?.error?.({
        stage: 'insert_interview',
        sessionId,
        resumeId,
        slot,
        err: insErr.message,
      });
      const raw = String(insErr.message || '');
      const isUnique =
        insErr.code === '23505' ||
        raw.toLowerCase().includes('unique') ||
        raw.toLowerCase().includes('duplicate');
      const message = isUnique
        ? 'Interview already scheduled for this candidate'
        : formatError(insErr.message);
      const status = isUnique ? 400 : 500;
      return res.status(status).json({
        error: message,
        stage: 'insert_interview',
      });
    }

    req.log?.info?.(
      { sessionId, resumeId, slot, interviewId: row.id, userId: req.user.id },
      'interviews: scheduled',
    );
    return res.status(201).json({ interview: row });
  });

  return router;
}

module.exports = { interviewsRoutes };
