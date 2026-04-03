const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { formatError } = require('./formatError');

function toBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  throw new Error('File buffer is missing or not a Buffer/TypedArray');
}

async function extractPdfText(buffer, log) {
  const data = toBuffer(buffer);
  if (data.length < 5) {
    throw new Error('PDF buffer too small or empty');
  }
  const header = data.subarray(0, 4).toString('utf8');
  if (header !== '%PDF' && log) {
    log.warn({ header: JSON.stringify(header) }, 'parse: PDF does not start with %PDF — attempting parse anyway');
  }

  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return (result && result.text) || '';
  } finally {
    try {
      if (typeof parser.destroy === 'function') await parser.destroy();
    } catch {
      // ignore cleanup errors
    }
  }
}

async function extractDocxText(buffer) {
  const buf = toBuffer(buffer);
  const result = await mammoth.extractRawText({ buffer: buf });
  return (result && result.value) || '';
}

/**
 * @param {{ buffer: Buffer, fileType: string, log?: import('pino').Logger }} opts
 */
async function extractTextFromBuffer({ buffer, fileType, log }) {
  try {
    if (fileType === 'pdf') {
      const text = await extractPdfText(buffer, log);
      if (log) log.debug({ fileType, chars: text.length }, 'parse: pdf text extracted');
      return text;
    }
    if (fileType === 'docx') {
      const text = await extractDocxText(buffer);
      if (log) log.debug({ fileType, chars: text.length }, 'parse: docx text extracted');
      return text;
    }
    throw new Error(`Unsupported fileType: ${fileType}`);
  } catch (err) {
    const stage = fileType === 'pdf' ? 'pdf-parse' : fileType === 'docx' ? 'mammoth' : 'parse';
    const msg = formatError(err);
    if (log) log.warn({ err: msg, stage, fileType }, 'parse: extraction failed');
    throw new Error(`${stage}: ${msg}`);
  }
}

function detectFileType({ mimetype, originalname }) {
  const lower = (originalname || '').toLowerCase();
  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  )
    return 'docx';
  return null;
}

module.exports = { extractTextFromBuffer, detectFileType };
