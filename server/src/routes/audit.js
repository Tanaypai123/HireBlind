const express = require('express');

function auditRoutes({ supabase, auth, requireAnyRole }) {
  const router = express.Router();

  router.get('/session/:sessionId', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const sessionId = req.params.sessionId;

    const { data: session, error: sErr } = await supabase
      .from('screening_sessions')
      .select('id,title,status,created_at,created_by')
      .eq('id', sessionId)
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: 'Database error' });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: resumes, error: rErr } = await supabase
      .from('resumes')
      .select('id,candidate_code,score_breakdown')
      .eq('session_id', sessionId);
    if (rErr) return res.status(500).json({ error: 'Database error' });

    const resumeIds = (resumes || []).map((r) => r.id);
    const { data: logs, error: lErr } = resumeIds.length
      ? await supabase
          .from('audit_logs')
          .select('id,resume_id,action_type,fields_removed,actor_id,override_reason,logged_at')
          .in('resume_id', resumeIds)
          .order('logged_at', { ascending: false })
      : { data: [], error: null };
    if (lErr) return res.status(500).json({ error: 'Database error' });

    const { count: overridesCount, error: oErr } = await supabase
      .from('overrides')
      .select('*', { count: 'exact', head: true });
    if (oErr) return res.status(500).json({ error: 'Database error' });

    const totalPiiFieldsRemoved = (logs || [])
      .filter((l) => l.action_type === 'pii_removal')
      .reduce((acc, l) => acc + (Array.isArray(l.fields_removed) ? l.fields_removed.length : 0), 0);

    const confidenceByCandidate = (resumes || []).map((r) => ({
      resume_id: r.id,
      candidate_code: r.candidate_code,
      confidence: r.score_breakdown?.confidence ?? null,
    }));

    return res.json({
      session,
      total_pii_fields_removed: totalPiiFieldsRemoved,
      human_overrides_count: overridesCount || 0,
      audit_logs: logs || [],
      compliance_statement: 'EU AI Act Article 13 transparency obligation met',
      confidence_by_candidate: confidenceByCandidate,
    });
  });

  return router;
}

module.exports = { auditRoutes };

