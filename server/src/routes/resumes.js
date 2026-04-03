const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { extractTextFromBuffer, detectFileType } = require('../utils/parseResume');
const { regexAnonymise } = require('../utils/anonymize');
const { extractProbableName } = require('../utils/extractName');
const { candidateCodeForIndex } = require('../utils/candidateCode');
const { formatError } = require('../utils/formatError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function resumesRoutes({ supabase, auth, requireRole, requireAnyRole, claudeClient, claudeAnonymise }) {
  const router = express.Router();

  router.post('/upload/:sessionId', auth, requireRole('admin'), upload.array('files', 50), async (req, res) => {
    const sessionId = req.params.sessionId;
    const files = req.files || [];
    if (!Array.isArray(files) || files.length < 5) {
      return res.status(400).json({ error: 'Minimum 5 files required per upload.' });
    }

    const { data: session, error: sErr } = await supabase
      .from('screening_sessions')
      .select('id,status')
      .eq('id', sessionId)
      .maybeSingle();
    if (sErr) {
      req.log?.error?.({ err: formatError(sErr) }, 'upload: session lookup failed');
      return res.status(500).json({ error: 'Database error', detail: formatError(sErr) });
    }
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'open') return res.status(400).json({ error: 'Session is not open for uploads' });

    const { count: existingCount, error: cErr } = await supabase
      .from('resumes')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    if (cErr) {
      req.log?.error?.({ err: formatError(cErr) }, 'upload: resume count failed');
      return res.status(500).json({ error: 'Database error', detail: formatError(cErr) });
    }
    let nextIndex = existingCount || 0;

    const results = [];

    for (const f of files) {
      const originalName = f.originalname || 'file';
      const fileType = detectFileType({ mimetype: f.mimetype, originalname: originalName });
      if (!fileType) {
        results.push({ originalName, status: 'error', stage: 'validate', error: 'Unsupported file type (PDF/DOCX only)' });
        continue;
      }

      let stage = 'init';
      try {
        if (!f.buffer || f.buffer.length === 0) {
          throw new Error('Empty file buffer (multer did not receive bytes)');
        }

        stage = 'parse';
        req.log?.info?.({ originalName, fileType, bytes: f.buffer.length }, 'upload: parsing file');
        const extractedText = await extractTextFromBuffer({
          buffer: f.buffer,
          fileType,
          log: req.log,
        });
        if (!extractedText || extractedText.trim().length < 50) {
          throw new Error(
            `Extracted text too short (${(extractedText || '').trim().length} chars). File may be image-only, encrypted, or corrupt.`,
          );
        }

        const probableCandidateName = extractProbableName(extractedText);

        stage = 'anonymise_regex';
        let phase1;
        try {
          phase1 = regexAnonymise(extractedText);
        } catch (regErr) {
          req.log?.error?.({ originalName, err: formatError(regErr) }, 'upload: regex anonymisation failed');
          throw new Error(`Regex anonymisation failed: ${formatError(regErr)}`);
        }

        stage = 'anonymise_claude';
        const phase2 = await claudeAnonymise({
          client: claudeClient,
          text: phase1.text,
          log: req.log,
        });
        if (phase2.skipReason === 'claude_error' && phase2.error) {
          req.log?.warn?.({ originalName, err: phase2.error }, 'upload: Claude PII pass skipped (using regex output)');
        }
        const anonymisedText = (phase2.text || phase1.text || '').trim();
        if (!anonymisedText || anonymisedText.length < 20) {
          throw new Error('Anonymised text empty after pipeline');
        }

        stage = 'database';
        const candidateCode = candidateCodeForIndex(nextIndex);
        nextIndex += 1;

        const { data: resume, error: rErr } = await supabase
          .from('resumes')
          .insert({
            session_id: sessionId,
            candidate_code: candidateCode,
            anonymised_text: anonymisedText,
            original_name: probableCandidateName,
            file_type: fileType,
          })
          .select('id,candidate_code')
          .single();
        if (rErr) {
          req.log?.error?.({ originalName, err: formatError(rErr) }, 'upload: insert resume failed');
          throw new Error(`Database insert failed: ${formatError(rErr)}`);
        }

        stage = 'audit';
        const fieldsRemoved = [
          ...(phase1.fieldsRemoved || []),
          ...(phase2.usedClaude ? [{ field: 'residual_pii', count: null, method: 'claude' }] : []),
          ...(phase2.skipReason && !phase2.usedClaude
            ? [{ field: 'claude_pass', method: phase2.skipReason }]
            : []),
        ];

        const { error: auditErr } = await supabase.from('audit_logs').insert({
          resume_id: resume.id,
          action_type: 'pii_removal',
          fields_removed: fieldsRemoved,
          actor_id: req.user.id,
        });
        if (auditErr) {
          req.log?.error?.({ originalName, err: formatError(auditErr) }, 'upload: audit log insert failed (resume stored)');
        }

        results.push({
          originalName,
          status: 'stored',
          candidateCode,
          anonymisation: {
            usedClaude: Boolean(phase2.usedClaude),
            skipReason: phase2.skipReason || null,
          },
        });
        req.log?.info?.({ originalName, candidateCode, resumeId: resume.id }, 'upload: file stored');
      } catch (e) {
        const msg = formatError(e);
        req.log?.error?.({ originalName, stage, err: msg }, 'upload: file processing failed');
        results.push({ originalName, status: 'error', stage, error: msg });
      }
    }

    return res.json({ files: results });
  });

  router.get('/anonymised/:resumeId', auth, async (req, res) => {
    const parsed = z.object({ resumeId: z.string().uuid() }).safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid resume id' });
    const { resumeId } = parsed.data;

    const { data: row, error } = await supabase
      .from('resumes')
      .select('id,session_id,candidate_code,anonymised_text,uploaded_at')
      .eq('id', resumeId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'Database error', detail: formatError(error) });
    if (!row) return res.status(404).json({ error: 'Not found' });

    return res.json({ resume: row });
  });

  /** Minimal payload for blind resume viewer. */
  router.get('/:resumeId', auth, requireAnyRole(['admin', 'recruiter']), async (req, res) => {
    const parsed = z.object({ resumeId: z.string().uuid() }).safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid resume id' });
    const { resumeId } = parsed.data;

    const { data: row, error } = await supabase
      .from('resumes')
      .select('candidate_code,anonymised_text')
      .eq('id', resumeId)
      .maybeSingle();
    if (error) {
      req.log?.error?.({ resumeId, err: error.message }, 'resume: fetch failed');
      return res.status(500).json({ error: formatError(error.message), stage: 'fetch_resume' });
    }
    if (!row) return res.status(404).json({ error: 'Not found' });

    return res.json({
      candidate_code: row.candidate_code,
      anonymised_text: row.anonymised_text,
    });
  });

  return router;
}

module.exports = { resumesRoutes };
