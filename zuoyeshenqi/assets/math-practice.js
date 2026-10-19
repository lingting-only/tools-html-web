(function(root) {
  "use strict";
  const Bank = typeof module === "object" && module.exports ? require("./bank-editor.js") : root.QuizBank;
  const Variety = typeof module === "object" && module.exports ? require("./question-variety.js") : root.QuizQuestionVariety;
  function plan({ description, count, type = "mixed", difficulty = "medium" } = {}) {
    if (typeof description !== "string" || !["mixed", "calculation"].includes(type) || !["easy", "medium", "hard"].includes(difficulty)) return null;
    // Only recognize an explicit, narrow request. Extra constraints always go to AI.
    const text = description.normalize("NFKC").replace(/[\s:：,，、。()（）+➕]/g, "");
    const match = text.match(/^(?:小学)?(?:3|三)年级数学(?:(?:计算)?练习题?)?(\d{1,4})(?:道|个)?口算(?:练习)?题?(\d{1,4})(?:道|个)?(?:复合|综合|混合)(?:算式|运算|计算)?(?:练习)?题?$/);
    if (!match) return null;
    const mental = Number(match[1]), compound = Number(match[2]), total = mental + compound;
    if (!total || total > Bank.LIMIT || count != null && count !== "" && count !== total) return null;
    return { mental, compound, total, difficulty };
  }
  function randomSource() {
    let state = root.crypto?.getRandomValues ? root.crypto.getRandomValues(new Uint32Array(1))[0] : (Date.now() ^ Math.floor(Math.random() * 0xffffffff));
    return () => {
      state += 0x6d2b79f5;
      let n = Math.imul(state ^ state >>> 15, 1 | state);
      n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }
  function generate(spec, history = [], { random = randomSource() } = {}) {
    const seen = new Set(history.map(Variety.signature)), questions = [], warnings = [];
    const integer = (min, max) => min + Math.floor(random() * (max - min + 1));
    const make = (expression, result, explanation, kind) => Bank.normalizeQuestion({
      type: "calculation", question: `${kind}：${expression} = ?`, options: [], answer: [String(result)], explanation
    }, questions.length, { requireAnswer: true });
    function mental() {
      const low = spec.difficulty === "hard" ? 30 : 10, high = spec.difficulty === "hard" ? 199 : spec.difficulty === "easy" ? 60 : 99;
      const a = integer(low, high), b = integer(low, high), family = integer(0, 3);
      if (family === 0) return make(`${a} + ${b}`, a + b, `${a} + ${b} = ${a + b}。`, "口算");
      if (family === 1) { const large = Math.max(a, b), small = Math.min(a, b); return make(`${large} − ${small}`, large - small, `${large} − ${small} = ${large - small}。`, "口算"); }
      const x = integer(spec.difficulty === "hard" ? 10 : 2, spec.difficulty === "hard" ? 60 : spec.difficulty === "easy" ? 9 : 20), y = integer(2, 9);
      if (family === 2) return make(`${x} × ${y}`, x * y, `${x} × ${y} = ${x * y}。`, "口算");
      return make(`${x * y} ÷ ${y}`, x, `${x} × ${y} = ${x * y}，所以 ${x * y} ÷ ${y} = ${x}。`, "口算");
    }
    function compound() {
      const n = spec.difficulty === "hard" ? 80 : spec.difficulty === "easy" ? 20 : 45;
      const a = integer(2, n), b = integer(2, n), c = integer(2, 9), family = integer(0, 7);
      if (family === 0) return make(`(${a} + ${b}) × ${c}`, (a + b) * c, `先算括号：${a} + ${b} = ${a + b}；再乘：${a + b} × ${c} = ${(a + b) * c}。`, "复合计算");
      if (family === 1) return make(`${a} × ${c} + ${b}`, a * c + b, `先乘：${a} × ${c} = ${a * c}；再加：${a * c} + ${b} = ${a * c + b}。`, "复合计算");
      if (family === 2) { const sub = integer(1, a * c - 1); return make(`${a} × ${c} − ${sub}`, a * c - sub, `先乘：${a} × ${c} = ${a * c}；再减：${a * c} − ${sub} = ${a * c - sub}。`, "复合计算"); }
      if (family === 3) { const left = integer(1, a * c - 1), right = a * c - left; return make(`(${left} + ${right}) ÷ ${c}`, a, `先算括号：${left} + ${right} = ${a * c}；再除：${a * c} ÷ ${c} = ${a}。`, "复合计算"); }
      if (family === 4) return make(`${a * c} ÷ ${c} + ${b}`, a + b, `先除：${a * c} ÷ ${c} = ${a}；再加：${a} + ${b} = ${a + b}。`, "复合计算");
      if (family === 5) return make(`${a * c + b} − ${a} × ${c}`, b, `先乘：${a} × ${c} = ${a * c}；再减：${a * c + b} − ${a * c} = ${b}。`, "复合计算");
      if (family === 6) { const sub = integer(1, a + b - 1); return make(`(${a} + ${b}) − ${sub}`, a + b - sub, `先算括号：${a} + ${b} = ${a + b}；再减：${a + b} − ${sub} = ${a + b - sub}。`, "复合计算"); }
      return make(`${a * c} ÷ ${c} × ${b}`, a * b, `同级运算从左到右：${a * c} ÷ ${c} = ${a}；${a} × ${b} = ${a * b}。`, "复合计算");
    }
    for (const [count, factory, name] of [[spec.mental, mental, "口算"], [spec.compound, compound, "复合计算"]]) {
      let accepted = 0;
      for (let attempt = 0; accepted < count && attempt < Math.max(4000, count * 100); attempt++) {
        const question = factory(), key = Variety.fingerprint(question);
        if (seen.has(key)) continue;
        seen.add(key); questions.push(question); accepted++;
      }
      if (accepted < count) warnings.push(`${name}仅生成 ${accepted}/${count} 道新题，题数尚未补齐；近期题目较多，请确认数量后练习。`);
    }
    if (!questions.length) throw Error("当前计算范围内暂时没有足够的新题，原练习未更改。");
    return { title: `三年级数学 · ${spec.mental}道口算＋${spec.compound}道复合计算`, source: "local-math", questions, warnings };
  }
  const api = { plan, generate };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizMathPractice = api;
})(typeof window !== "undefined" ? window : globalThis);
