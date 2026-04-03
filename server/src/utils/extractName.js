/**
 * Best-effort candidate name from raw resume text (before anonymisation).
 * Returns null if nothing looks reliable. Trimmed, max 200 chars for storage.
 */
function extractProbableName(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.replace(/\u00a0/g, ' ');
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const clean = (s) => {
    const t = (s || '').trim();
    if (!t) return null;
    return t.length > 200 ? t.slice(0, 200) : t;
  };

  // "Name: Jane Doe" or "Name - Jane Doe"
  const nameLabel = text.match(
    /^\s*Name\s*[:\-–]\s*([A-ZÁÉÍÓÚÄÖÜÅÑ][a-záéíóúäöüåñA-Z\s'.-]{2,80})$/im,
  );
  if (nameLabel) {
    const n = clean(nameLabel[1].replace(/\s+/g, ' '));
    if (n && !/@/.test(n)) return n;
  }

  // Same but anywhere in first 1500 chars (header block)
  const header = text.slice(0, 1500);
  const nameLabel2 = header.match(
    /Name\s*[:\-–]\s*([A-ZÁÉÍÓÚÄÖÜÅÑ][a-záéíóúäöüåñA-Z\s'.-]{2,80})/i,
  );
  if (nameLabel2) {
    const n = clean(nameLabel2[1].replace(/\s+/g, ' '));
    if (n && !/@/.test(n) && n.split(/\s+/).length <= 6) return n;
  }

  // Mr / Mrs / Dr / Prof + name (take suffix as display name)
  const titled = header.match(
    /\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+([A-ZÁÉÍÓÚÄÖÜÅÑ][a-záéíóúäöüåñA-Z']+(?:\s+[A-ZÁÉÍÓÚÄÖÜÅÑ][a-záéíóúäöüåñA-Z']+){0,3})\b/,
  );
  if (titled) {
    const n = clean(titled[2].replace(/\s+/g, ' '));
    if (n) return n;
  }

  // First line: 2–5 capitalised tokens, no email/phone-ish, short line (common CV header)
  const first = lines[0];
  if (first && first.length <= 90 && !/@/.test(first) && !/https?:/i.test(first)) {
    const parts = first.split(/\s+/).filter(Boolean);
    const wordPattern = /^[A-ZÁÉÍÓÚÄÖÜÅÑ][a-záéíóúäöüåñ'.-]*$/;
    const capWords = parts.filter((w) => wordPattern.test(w));
    if (capWords.length >= 2 && capWords.length <= 5 && parts.length <= 6) {
      return clean(capWords.join(' '));
    }
  }

  return null;
}

module.exports = { extractProbableName };
