function numberToCode(n) {
  // 0 -> A, 25 -> Z, 26 -> AA, ...
  let x = n;
  let out = '';
  while (x >= 0) {
    out = String.fromCharCode(65 + (x % 26)) + out;
    x = Math.floor(x / 26) - 1;
  }
  return out;
}

function candidateCodeForIndex(i) {
  return `Candidate ${numberToCode(i)}`;
}

module.exports = { candidateCodeForIndex };

