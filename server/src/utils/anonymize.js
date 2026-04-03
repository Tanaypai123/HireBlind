const TITLE_NAME_RE = /\b(Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(\s?(ext|x)\s?\d{1,5})?/gi;
const DOB_RE =
  /\b(DOB|Date of Birth|Birthdate|Born)\b[:\s-]*\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})\b/gi;
const AGE_RE = /\b(\d{1,2})\s*(years old|yo)\b/gi;
const PRONOUNS_RE = /\b(he\/him|she\/her|they\/them|he|him|his|she|her|hers|they|them|their|theirs)\b/gi;
const GENDER_DECL_RE = /\b(male|female|non-binary|nonbinary|woman|man|transgender)\b/gi;
const NATIONALITY_RE =
  /\b(nationality|citizenship|citizen of|passport)\b[:\s-]*[A-Za-z ,.-]{2,60}\b/gi;
const ADDRESS_RE =
  /\b(\d{1,5}\s+[\w.\- ]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Place|Pl|Square|Sq)\b[\w ,.-]{0,40})/gi;
const POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi; // UK-ish
const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;
const LINKEDIN_RE = /\blinkedin\.com\/[^\s)]+/gi;
const GITHUB_RE = /\bgithub\.com\/[^\s)]+/gi;
const PHOTO_RE = /\b(photo|headshot|portrait|profile picture)\b/gi;

const UNIVERSITY_HINT_RE =
  /\b(University of [A-Za-z][A-Za-z .'-]{1,60}|[A-Za-z][A-Za-z .'-]{1,60}\s+(University|College|Institute of Technology|Polytechnic))\b/g;

function countMatches(re, s) {
  if (!s) return 0;
  const m = s.match(re);
  return m ? m.length : 0;
}

function regexAnonymise(text) {
  let t = text || '';
  const removed = [];

  const remove = (label, re, token) => {
    const c = countMatches(re, t);
    if (c > 0) removed.push({ field: label, count: c, method: 'regex' });
    t = t.replace(re, token);
  };

  remove('title_name', TITLE_NAME_RE, '[NAME_REMOVED]');
  remove('email', EMAIL_RE, '[EMAIL_REMOVED]');
  remove('phone', PHONE_RE, '[PHONE_REMOVED]');
  remove('dob', DOB_RE, '[DOB_REMOVED]');
  remove('age', AGE_RE, '[AGE_REMOVED]');
  remove('pronouns', PRONOUNS_RE, '[PRONOUN_REMOVED]');
  remove('gender', GENDER_DECL_RE, '[GENDER_REMOVED]');
  remove('nationality', NATIONALITY_RE, '[NATIONALITY_REMOVED]');
  remove('address', ADDRESS_RE, '[ADDRESS_REMOVED]');
  remove('postal_code', POSTCODE_RE, '[POSTCODE_REMOVED]');
  remove('url', URL_RE, '[URL_REMOVED]');
  remove('linkedin', LINKEDIN_RE, '[URL_REMOVED]');
  remove('github', GITHUB_RE, '[URL_REMOVED]');
  remove('photo_reference', PHOTO_RE, '[PHOTO_REFERENCE_REMOVED]');

  // University names → placeholder, deterministic by order of appearance
  const uniMap = new Map();
  let uniIndex = 0;
  t = t.replace(UNIVERSITY_HINT_RE, (match) => {
    const key = match.trim();
    if (!uniMap.has(key)) {
      const code = `University ${String.fromCharCode(65 + (uniIndex % 26))}`;
      uniMap.set(key, code);
      uniIndex += 1;
    }
    return uniMap.get(key);
  });
  if (uniMap.size > 0) {
    removed.push({ field: 'university', count: uniMap.size, method: 'regex' });
  }

  // Best-effort removal of common "Name:" headers
  const nameHeaderRe = /\b(Name)\s*:\s*[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b/g;
  const nh = countMatches(nameHeaderRe, t);
  if (nh > 0) removed.push({ field: 'name_header', count: nh, method: 'regex' });
  t = t.replace(nameHeaderRe, '$1: [NAME_REMOVED]');

  return { text: t, fieldsRemoved: removed };
}

module.exports = { regexAnonymise };

