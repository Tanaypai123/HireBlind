/**
 * Keyword-overlap heuristic when Claude is unavailable or fails.
 * Produces the same shape as Claude JSON so downstream validation stays consistent.
 */

function tokenize(s) {
  const words = (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

function overlapRatio(smaller, larger) {
  if (!smaller.size || !larger.size) return 0;
  let hits = 0;
  for (const w of smaller) {
    if (larger.has(w)) hits += 1;
  }
  return hits / smaller.size;
}

function yearsExperienceScore(text) {
  const t = text || '';
  const m =
    t.match(/\b(\d{1,2})\+?\s*(years?|yrs?)\s*(of\s*)?(experience|exp)?\b/i) ||
    t.match(/\b(\d{1,2})\s*years?\s+of\s+experience\b/i);
  if (m) {
    const y = Math.min(40, parseInt(m[1], 10));
    return Math.min(100, 15 + y * 12);
  }
  return 48;
}

function buildFallbackScore(jobDescription, anonymisedText) {
  const jd = tokenize(jobDescription);
  const resume = tokenize(anonymisedText);
  const matched = [...jd].filter((w) => resume.has(w));

  const skills_match = Math.min(100, Math.round(overlapRatio(jd, resume) * 100) || (matched.length ? 40 : 15));
  const experience_relevance = Math.min(
    100,
    Math.round(skills_match * 0.85 + Math.min(25, matched.length * 3)),
  );
  const rawYears = yearsExperienceScore(anonymisedText);
  const years_of_experience = Math.min(100, Math.round(rawYears));

  const overall_score = Math.round(
    skills_match * 0.4 + experience_relevance * 0.4 + years_of_experience * 0.2,
  );

  const explainability_tags =
    matched.length > 0
      ? matched.slice(0, 10).map((w) => `${w} ✓`)
      : ['Heuristic scoring (keyword overlap) ✓', 'ANTHROPIC_API_KEY not set or Claude failed ✓'];

  return {
    skills_match: Math.max(0, Math.min(100, skills_match)),
    experience_relevance: Math.max(0, Math.min(100, experience_relevance)),
    years_of_experience: Math.max(0, Math.min(100, years_of_experience)),
    overall_score: Math.max(0, Math.min(100, overall_score)),
    confidence: 38,
    explainability_tags,
    strengths: [
      'Scored via local keyword overlap with job description (no LLM).',
      `${matched.length} job-description term(s) overlapped with resume text.`,
    ],
    gaps: [
      'Configure ANTHROPIC_API_KEY and re-rank for fuller, merit-based scoring.',
    ],
    scoring_method: 'heuristic_fallback',
  };
}

module.exports = { buildFallbackScore };
