(function(root) {
  "use strict";
  const KEY = "kenti-ai-question-history-v1", LIMIT = 2000, MAX_CHARS = 240000;
  function digest(text) {
    let a = 2166136261, b = 5381;
    for (const char of text) { const n = char.codePointAt(0); a = Math.imul(a ^ n, 16777619); b = Math.imul(b, 33) ^ n; }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  }
  function fingerprint(question) {
    let stem = String(question.stem ?? question.question ?? "").normalize("NFKC").toLowerCase()
      .replace(/^\s*(?:第\d+题[：:.、]?|\d+[、]|\d+\.\s+)\s*/, "")
      .replace(/[−–—]/g, "-").replace(/[×✕✖]/g, "*").replace(/➕/g, "+").replace(/÷/g, "/")
      .replace(/[\s，。？！?!、：:;；"'“”‘’]/g, "");
    if (question.type === "calculation") {
      stem = stem.replace(/^(?:请)?(?:口算练习|口算|复合计算|复合运算|混合运算|综合算式|综合计算|脱式计算|计算|求值)/, "").replace(/=(?:[()_□])*$/, "");
      const pair = stem.match(/^(\d+(?:\.\d+)?)([+*])(\d+(?:\.\d+)?)$/);
      if (pair) {
        const normalize = n => n.replace(/^0+(?=\d)/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
        stem = [normalize(pair[1]), normalize(pair[3])].sort().join(pair[2]);
      }
    }
    return digest(stem);
  }
  function signature(question) {
    return question.signatureVersion === 2 && /^[a-f0-9]{16}$/.test(question.signature || "") ? question.signature : fingerprint(question);
  }
  function compact(questions) {
    const seen = new Set(), items = [];
    let size = 0;
    for (let i = questions.length - 1; i >= 0; i--) {
      const question = questions[i];
      if (!question || typeof question.stem !== "string" || !question.stem.trim()) continue;
      const key = signature(question);
      if (seen.has(key)) continue;
      const item = { type: String(question.type || ""), stem: question.stem.slice(0, 1200), signature: key, signatureVersion: 2 };
      const length = JSON.stringify(item).length;
      if (items.length >= LIMIT || size + length > MAX_CHARS) break;
      seen.add(key); items.push(item); size += length;
    }
    return items.reverse();
  }
  function createHistory(storage) {
    let items = [];
    try { const saved = JSON.parse(storage?.getItem(KEY) || "null"); if (Array.isArray(saved)) items = compact(saved); } catch {}
    return {
      list: () => items.map(item => ({ ...item })),
      remember(questions) {
        items = compact([...items, ...questions.map(q => ({ type: q.type, stem: q.stem, signature: fingerprint(q), signatureVersion: 2 }))]);
        try { if (!storage) return false; storage.setItem(KEY, JSON.stringify(items)); return true; } catch { return false; }
      }
    };
  }
  function duplicates(questions, history = []) {
    const seen = new Set(history.map(signature)), repeated = [];
    questions.forEach(question => { const key = fingerprint(question); if (seen.has(key)) repeated.push(question); seen.add(key); });
    return repeated;
  }
  // A bounded prompt hint gives the model real exclusions without sending the full history.
  function exclusionText(history = [], priority = [], seed = "", omitted = []) {
    const omit = new Set(omitted.map(fingerprint)), seen = new Set(), selected = [];
    const unique = history.filter(q => {
      if (!q || typeof q.stem !== "string") return false;
      const key = signature(q);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    const recent = unique.slice(-24).reverse(), older = unique.slice(0, -24);
    let offset = parseInt(digest(String(seed)).slice(0, 8), 16) % Math.max(1, older.length);
    // Visit a rotating slice of older questions as well as the most recent ones.
    const rotated = older.slice(offset).concat(older.slice(0, offset));
    seen.clear();
    for (const q of [...priority, ...recent, ...rotated]) {
      if (!q || typeof q.stem !== "string") continue;
      const key = signature(q);
      if (seen.has(key) || omit.has(key)) continue;
      const normalized = q.stem.normalize("NFKC").trim();
      const stem = (q.type === "calculation"
        ? normalized.replace(/\s+/g, "").replace(/^(?:请计算|计算|口算|综合算式)[:：]?/, "").replace(/=[?？_()□]*$/, "").slice(0, 100)
        : normalized.replace(/\s+/g, " ").slice(0, 80));
      const next = JSON.stringify([...selected, stem]);
      if (next.length > 1800 || selected.length >= 200) break;
      selected.push(stem); seen.add(key);
    }
    return JSON.stringify(selected);
  }
  const api = { KEY, fingerprint, signature, createHistory, duplicates, exclusionText };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizQuestionVariety = api;
})(typeof window !== "undefined" ? window : globalThis);
