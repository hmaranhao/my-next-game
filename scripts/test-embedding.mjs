/** Smoke test: cosine vs L2 */
function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function l2Distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

const a = [1, 0, 0];
const b = [1, 0, 0];
const c = [0, 1, 0];

if (cosineSimilarity(a, b) < 0.99) throw new Error("cosine identical");
if (cosineSimilarity(a, c) > 0.01) throw new Error("cosine orthogonal");
if (l2Distance(a, b) > 0.01) throw new Error("l2 identical");
if (l2Distance(a, c) < 0.99) throw new Error("l2 different");

console.log("embedding distance tests OK");
