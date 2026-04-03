const Anthropic = require('@anthropic-ai/sdk');

function createClaudeClient(apiKey) {
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

async function claudeAnonymise({ client, text, log }) {
  if (!client) {
    if (log) log.info('anonymise: skipping Claude (no ANTHROPIC_API_KEY); using regex-only output');
    return { text, usedClaude: false, skipReason: 'no_api_key' };
  }
  try {
    const msg = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0,
      system:
        'You are a PII anonymisation engine. Remove ALL remaining personally identifiable information. Replace names with [NAME_REMOVED], emails with [EMAIL_REMOVED], etc. Replace university names with University A/B/C. DO NOT remove job titles, company names, skills, technologies, years of experience, or certifications. Return ONLY the cleaned text.',
      messages: [{ role: 'user', content: text }],
    });
    const out = msg.content?.[0]?.text || '';
    return { text: (out || '').trim(), usedClaude: true };
  } catch (err) {
    const message = err?.message || String(err);
    if (log) log.warn({ err: message }, 'anonymise: Claude failed; falling back to regex-only text');
    return { text, usedClaude: false, skipReason: 'claude_error', error: message };
  }
}

async function claudeScore({ client, jobDescription, anonymisedText }) {
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }
  const msg = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    temperature: 0.2,
    system:
      'You are an objective, bias-free hiring assistant. Evaluate anonymised resumes on professional merit only. You will never see names, contact details, age, gender, or nationality.',
    messages: [
      {
        role: 'user',
        content: `Score this anonymised resume against the job description.\n\nJOB DESCRIPTION: ${jobDescription}\n\nANONYMISED RESUME: ${anonymisedText}\n\nReturn ONLY valid JSON (numbers, not strings for scores):\n{\n  "skills_match": <integer 0-100>,\n  "experience_relevance": <integer 0-100>,\n  "years_of_experience": <integer 0-100>,\n  "overall_score": <integer 0-100, use round(0.4*skills_match + 0.4*experience_relevance + 0.2*years_of_experience)>,\n  "confidence": <integer 0-100>,\n  "explainability_tags": ["Python ✓", "3 years experience ✓", "team lead ✓"],\n  "strengths": ["string"],\n  "gaps": ["string"]\n}`,
      },
    ],
  });
  const raw = msg.content?.[0]?.text || '';
  return raw.trim();
}

module.exports = { createClaudeClient, claudeAnonymise, claudeScore };

