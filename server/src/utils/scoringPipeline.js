const { buildFallbackScore } = require('./scoringFallback');
const { formatError } = require('./formatError');

/**
 * Try Claude JSON scoring; on missing key, bad JSON, validation error, or API error — use heuristic fallback.
 */
async function scoreResumeWithFallback({
  claudeScoreRaw,
  client,
  jobDescription,
  anonymisedText,
  log,
  resumeId,
  validateBreakdown,
}) {
  if (!client) {
    if (log)
      log.warn(
        { resumeId, candidateHint: (anonymisedText || '').slice(0, 80) },
        'ranking: ANTHROPIC_API_KEY missing — heuristic fallback scoring',
      );
    return { breakdown: buildFallbackScore(jobDescription, anonymisedText), scoringSource: 'heuristic_fallback' };
  }

  try {
    const raw = await claudeScoreRaw({ client, jobDescription, anonymisedText });
    let json;
    try {
      json = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(`Invalid JSON from Claude: ${formatError(parseErr)} | snippet=${String(raw).slice(0, 200)}`);
    }
    const breakdown = validateBreakdown(json);
    return {
      breakdown: { ...breakdown, scoring_method: breakdown.scoring_method || 'claude' },
      scoringSource: 'claude',
    };
  } catch (err) {
    const msg = formatError(err);
    if (log)
      log.warn(
        { resumeId, err: msg },
        'ranking: Claude scoring failed — heuristic fallback scoring',
      );
    const fallback = buildFallbackScore(jobDescription, anonymisedText);
    return {
      breakdown: {
        ...fallback,
        scoring_note: `Claude error: ${msg}`,
      },
      scoringSource: 'heuristic_fallback',
    };
  }
}

module.exports = { scoreResumeWithFallback };
