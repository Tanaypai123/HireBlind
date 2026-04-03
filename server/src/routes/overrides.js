const express = require('express');
const { z } = require('zod');
const { formatError } = require('../utils/formatError');
const { reorderSessionRankings } = require('../utils/reorderRankings');

const postBody = z.object({
  rankingId: z.string().uuid(),
  newRank: z.coerce.number().int().min(1),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

function overridesRoutes({ supabase, auth, requireAnyRole }) {
  const router = express.Router();

  /**
   * Manual reorder: record override + audit + apply new ranks for the session.
   */
  router.post('/', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const parsed = postBody.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return res.status(400).json({
        error: first?.message || 'Invalid input',
        code: 'VALIDATION',
      });
    }

    const { rankingId, newRank, reason } = parsed.data;

    try {
      const { data: ranking, error: rErr } = await supabase
        .from('rankings')
        .select('id,session_id,resume_id,rank')
        .eq('id', rankingId)
        .maybeSingle();

      if (rErr) {
        req.log?.error?.({ stage: 'override_fetch_ranking', err: rErr.message, rankingId });
        return res.status(500).json({ error: formatError(rErr.message), stage: 'override_fetch_ranking' });
      }
      if (!ranking) return res.status(404).json({ error: 'Ranking not found' });

      const { data: session, error: sErr } = await supabase
        .from('screening_sessions')
        .select('id,status')
        .eq('id', ranking.session_id)
        .maybeSingle();
      if (sErr) {
        req.log?.error?.({ stage: 'override_fetch_session', err: sErr.message });
        return res.status(500).json({ error: formatError(sErr.message), stage: 'override_fetch_session' });
      }
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.status !== 'ranked') {
        req.log?.warn?.({
          sessionId: ranking.session_id,
          status: session.status,
          rankingId,
          userRole: req.user.role,
          reason: 'session_not_ranked',
        });
        return res.status(400).json({ error: 'Session must be ranked before changing ranks' });
      }

      await reorderSessionRankings(supabase, ranking.session_id, rankingId, newRank);

      const { data: ov, error: oErr } = await supabase
        .from('overrides')
        .insert({
          ranking_id: rankingId,
          override_by: String(req.user.id),
          reason: reason.trim(),
        })
        .select('id,ranking_id,reason,overridden_at')
        .single();

      if (oErr) {
        req.log?.error?.({ stage: 'override_insert', err: oErr.message, rankingId });
        return res.status(500).json({ error: formatError(oErr.message), stage: 'override_insert' });
      }

      const { error: aErr } = await supabase.from('audit_logs').insert({
        resume_id: ranking.resume_id,
        action_type: 'human_override',
        actor_id: String(req.user.id),
        override_reason: reason.trim(),
        fields_removed: { new_rank: newRank, previous_rank: ranking.rank },
      });
      if (aErr) {
        req.log?.warn?.({ err: aErr.message }, 'override: audit log insert failed (ranks already updated)');
      }

      req.log?.info?.(
        {
          rankingId,
          sessionId: ranking.session_id,
          resumeId: ranking.resume_id,
          newRank,
          userId: req.user.id,
        },
        'overrides: manual rank change applied',
      );

      return res.status(201).json({ override: ov, ok: true });
    } catch (e) {
      const msg = formatError(e);
      req.log?.warn?.({ rankingId, newRank, err: msg, userId: req.user.id }, 'overrides: failed');
      return res.status(400).json({ error: msg, code: 'OVERRIDE_FAILED' });
    }
  });

  return router;
}

module.exports = { overridesRoutes };
