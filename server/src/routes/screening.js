const express = require('express');
const { z } = require('zod');
const { claudeScore } = require('../utils/claude');
const { scoreResumeWithFallback } = require('../utils/scoringPipeline');
const { formatError } = require('../utils/formatError');

const createSessionSchema = z.object({
  title: z.string().min(1),
  job_description: z.string().min(20),
});

const scoreSchema = z.object({
  skills_match: z.coerce.number().min(0).max(100),
  experience_relevance: z.coerce.number().min(0).max(100),
  years_of_experience: z.coerce.number().min(0).max(100),
  overall_score: z.coerce.number().min(0).max(100),
  confidence: z.coerce.number().min(0).max(100),
  explainability_tags: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  scoring_method: z.string().optional(),
  scoring_note: z.string().optional(),
});

const revealBodySchema = z.object({
  resumeId: z.string().uuid(),
});

function screeningRoutes({
  supabase,
  auth,
  requireRole,
  requireAnyRole,
  claudeClient,
}) {
  const router = express.Router();

  router.get('/sessions', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const { data, error } = await supabase
      .from('screening_sessions')
      .select('id,title,status,created_at,created_by')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.json({ sessions: data || [] });
  });

  router.post('/sessions', auth, requireRole('admin'), async (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    const { data, error } = await supabase
      .from('screening_sessions')
      .insert({
        created_by: req.user.id,
        title: parsed.data.title,
        job_description: parsed.data.job_description,
        status: 'open',
      })
      .select('id,title,status,created_at')
      .single();
    if (error) return res.status(500).json({ error: 'Database error' });
    return res.status(201).json({ session: data });
  });

  router.get('/sessions/:sessionId', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const sessionId = req.params.sessionId;
    const { data: session, error } = await supabase
      .from('screening_sessions')
      .select('id,title,status,created_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Database error' });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json({ session });
  });

  router.get('/sessions/:sessionId/rankings', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const sessionId = req.params.sessionId;
    const { data: session, error: sErr } = await supabase
      .from('screening_sessions')
      .select('id,title,status,job_description,created_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: 'Database error' });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: rows, error } = await supabase
      .from('rankings')
      .select('id,rank,resume_id,explainability_tags,ranked_at')
      .eq('session_id', sessionId)
      .order('rank', { ascending: true });
    if (error) return res.status(500).json({ error: 'Database error' });

    const resumeIds = (rows || []).map((r) => r.resume_id);
    let resumeMap = new Map();
    if (resumeIds.length) {
      const { data: resumes, error: rErr } = await supabase
        .from('resumes')
        .select('id,candidate_code,score,score_breakdown')
        .in('id', resumeIds);
      if (rErr) return res.status(500).json({ error: 'Database error' });
      resumeMap = new Map((resumes || []).map((r) => [r.id, r]));
    }

    // Overrides status
    let overrideMap = new Map();
    if ((rows || []).length) {
      const rankingIds = rows.map((r) => r.id);
      const { data: overrides } = await supabase
        .from('overrides')
        .select('ranking_id,reason,overridden_at')
        .in('ranking_id', rankingIds);
      overrideMap = new Map((overrides || []).map((o) => [o.ranking_id, o]));
    }

    const rankings = (rows || []).map((r) => {
      const resume = resumeMap.get(r.resume_id);
      return {
        id: r.id,
        rank: r.rank,
        resume_id: r.resume_id,
        candidate_code: resume?.candidate_code || 'Candidate ?',
        score: resume?.score ?? 0,
        score_breakdown: resume?.score_breakdown || null,
        explainability_tags: Array.isArray(r.explainability_tags) ? r.explainability_tags : r.explainability_tags || [],
        override: overrideMap.get(r.id) || null,
      };
    });

    return res.json({ session, rankings });
  });

  router.post('/sessions/:sessionId/rank', auth, requireRole('admin'), async (req, res) => {
    const sessionId = req.params.sessionId;

    const { data: session, error: sErr } = await supabase
      .from('screening_sessions')
      .select('id,job_description,status')
      .eq('id', sessionId)
      .maybeSingle();
    if (sErr) return res.status(500).json({ error: 'Database error' });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { data: resumes, error: rErr } = await supabase
      .from('resumes')
      .select('id,anonymised_text,candidate_code,file_type')
      .eq('session_id', sessionId);
    if (rErr) return res.status(500).json({ error: 'Database error' });
    if (!resumes || resumes.length < 5) {
      return res.status(400).json({ error: 'Upload at least 5 resumes before ranking.' });
    }

    // Clear existing rankings (re-ranking is allowed; human overrides are reversible)
    await supabase.from('rankings').delete().eq('session_id', sessionId);

    const scored = await Promise.all(
      resumes.map(async (r) => {
        const { breakdown, scoringSource } = await scoreResumeWithFallback({
          claudeScoreRaw: claudeScore,
          client: claudeClient,
          jobDescription: session.job_description,
          anonymisedText: r.anonymised_text,
          log: req.log,
          resumeId: r.id,
          validateBreakdown: (json) => {
            const parsed = scoreSchema.safeParse(json);
            if (!parsed.success) {
              throw new Error(`Claude JSON failed validation: ${parsed.error.message}`);
            }
            return parsed.data;
          },
        });
        if (scoringSource === 'heuristic_fallback') {
          req.log?.info?.({ resumeId: r.id }, 'ranking: stored heuristic scores for candidate');
        }
        return { resume: r, breakdown };
      }),
    );

    scored.sort((a, b) => (b.breakdown.overall_score || 0) - (a.breakdown.overall_score || 0));

    // Update resumes and insert rankings
    for (let i = 0; i < scored.length; i += 1) {
      const { resume, breakdown } = scored[i];
      await supabase
        .from('resumes')
        .update({ score: breakdown.overall_score, score_breakdown: breakdown })
        .eq('id', resume.id);

      await supabase.from('rankings').insert({
        session_id: sessionId,
        resume_id: resume.id,
        rank: i + 1,
        explainability_tags: breakdown.explainability_tags || [],
      });

      await supabase.from('audit_logs').insert({
        resume_id: resume.id,
        action_type: 'ai_ranking',
        actor_id: req.user.id,
        fields_removed: null,
      });
    }

    await supabase.from('screening_sessions').update({ status: 'ranked' }).eq('id', sessionId);

    const shortlist = scored.map((s, idx) => ({
      rank: idx + 1,
      resume_id: s.resume.id,
      candidate_code: s.resume.candidate_code,
      score: s.breakdown.overall_score,
      score_breakdown: s.breakdown,
      explainability_tags: s.breakdown.explainability_tags || [],
    }));

    return res.json({ shortlist });
  });

  router.get('/sessions/:sessionId/shortlist', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const sessionId = req.params.sessionId;

    const { data: session, error: sessErr } = await supabase
      .from('screening_sessions')
      .select('id,status')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessErr) return res.status(500).json({ error: 'Database error' });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'ranked') {
      req.log?.warn?.(
        {
          sessionId,
          sessionStatus: session.status,
          userRole: req.user.role,
          userId: req.user.id,
          reason: 'session_not_ranked',
        },
        'scheduler: shortlist blocked',
      );
      return res.status(400).json({
        error: 'Session not ranked yet',
        code: 'NOT_RANKED',
        detail: 'Session must be ranked before scheduling',
      });
    }

    const { data: rows, error } = await supabase
      .from('rankings')
      .select('id,rank,resume_id')
      .eq('session_id', sessionId)
      .order('rank', { ascending: true });
    if (error) return res.status(500).json({ error: 'Database error' });

    const resumeIds = (rows || []).map((r) => r.resume_id).filter(Boolean);
    const { data: resumes, error: resListErr } = resumeIds.length
      ? await supabase.from('resumes').select('id,candidate_code').in('id', resumeIds)
      : { data: [], error: null };
    if (resListErr) return res.status(500).json({ error: 'Database error' });
    const byResumeId = new Map((resumes || []).map((r) => [String(r.id), r]));
    const shortlist = (rows || [])
      .map((r) => {
        const resumeIdStr = r.resume_id == null ? '' : String(r.resume_id).trim();
        const resumeRow = byResumeId.get(resumeIdStr);
        return {
          resume_id: resumeIdStr || null,
          candidate_code: resumeRow?.candidate_code || 'Candidate ?',
          rank: r.rank,
        };
      })
      .filter((item) => z.string().uuid().safeParse(item.resume_id).success);
    return res.json({ shortlist });
  });

  router.post('/sessions/:sessionId/reveal', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const sessionId = req.params.sessionId;
    const bodyParsed = revealBodySchema.safeParse(req.body || {});
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: 'resumeId must be a valid UUID for the resumes row',
        detail: bodyParsed.error.flatten(),
      });
    }
    const resumeId = bodyParsed.data.resumeId;

    const { data: session, error: sessErr } = await supabase
      .from('screening_sessions')
      .select('id,status')
      .eq('id', sessionId)
      .maybeSingle();
    if (sessErr) return res.status(500).json({ error: 'Database error' });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'ranked') {
      req.log?.warn?.(
        {
          sessionId,
          sessionStatus: session.status,
          userRole: req.user.role,
          reason: 'session_not_ranked',
        },
        'scheduler: reveal blocked',
      );
      return res.status(400).json({
        error: 'Session not ranked yet',
        code: 'NOT_RANKED',
        detail: 'Session must be ranked before scheduling',
      });
    }

    const { data: resume, error: rErr } = await supabase
      .from('resumes')
      .select('id,session_id,candidate_code,original_name')
      .eq('id', resumeId)
      .maybeSingle();
    if (rErr) {
      req.log?.error?.({ err: formatError(rErr) }, 'reveal: resume lookup failed');
      return res.status(500).json({ error: 'Database error', detail: formatError(rErr) });
    }
    if (!resume || resume.session_id !== sessionId) {
      return res.status(404).json({ error: 'Resume not found in this session' });
    }

    const auditResumeId = resume.id;
    if (!auditResumeId) {
      return res.status(400).json({ error: 'Invalid resume_id' });
    }
    console.log('[reveal_identity] resume_id', auditResumeId);

    const { error: auditErr } = await supabase.from('audit_logs').insert({
      resume_id: auditResumeId,
      action_type: 'reveal_identity',
      actor_id: req.user.id,
      logged_at: new Date().toISOString(),
    });
    if (auditErr) {
      req.log?.error?.({ err: formatError(auditErr) }, 'reveal: audit insert failed');
      return res.status(500).json({ error: 'Database error', detail: formatError(auditErr) });
    }

    return res.json({
      candidate_code: resume.candidate_code,
      original_name: resume.original_name,
    });
  });

  router.get('/resumes/:resumeId', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const resumeId = req.params.resumeId;
    const { data, error } = await supabase
      .from('resumes')
      .select('id,session_id,candidate_code,anonymised_text,score,score_breakdown,uploaded_at')
      .eq('id', resumeId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Database error' });
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json({ resume: data });
  });

  return router;
}

module.exports = { screeningRoutes };

