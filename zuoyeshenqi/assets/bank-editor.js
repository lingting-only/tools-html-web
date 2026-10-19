(function(root) {
  "use strict";
  const Calculation = typeof module === "object" && module.exports ? require("./calculation.js") : root.QuizCalculation;
  const MathReview = typeof module === "object" && module.exports ? require("./math-review.js") : root.QuizMathReview;
  const LIMIT = typeof module === "object" && module.exports ? require("./parser.js").LIMIT : root.QuizParser.LIMIT;
  const TYPES = ["single", "multiple", "boolean", "short", "calculation"];
  const text = value => typeof value === "string" ? value.trim() : "";
  const truth = value => value === true || /^(正确|对|true)$/i.test(String(value)) ? true : value === false || /^(错误|错|false)$/i.test(String(value)) ? false : null;
  function normalizeQuestion(raw, index = 0, { requireAnswer = false } = {}) {
    const fail = message => { throw Error(`第 ${index + 1} 题：${message}`); };
    if (!raw || typeof raw !== "object") fail("题目格式不正确。");
    const stem = text(raw.stem ?? raw.question), type = raw.type;
    if (!stem) fail("请填写题干。");
    if (stem.length > 10000) fail("题干最多 10,000 字。");
    if (!TYPES.includes(type)) fail("请选择有效的题型。");
    let options = raw.options ?? [];
    if (!Array.isArray(options)) fail("选项格式不正确。");
    if (type === "short" || type === "calculation") options = [];
    else if (type === "boolean" && !options.length) options = [{ id: "A", text: "正确" }, { id: "B", text: "错误" }];
    options = options.map((option, i) => typeof option === "string" ? { id: String.fromCharCode(65 + i), text: option.trim() } : { id: text(option?.id).toUpperCase(), text: text(option?.text) });
    if (type !== "short" && type !== "calculation") {
      if (options.length < 2 || options.length > 8) fail("需要 2–8 个选项。");
      if (type === "boolean" && options.length !== 2) fail("判断题需要两个选项。");
      if (options.some(option => !/^[A-H]$/.test(option.id) || !option.text || option.text.length > 3000)) fail("每个选项需要唯一的 A–H 编号和 1–3,000 字内容。");
      if (new Set(options.map(option => option.id)).size !== options.length) fail("选项编号不能重复。");
    }
    let answer = raw.answer;
    if (answer == null || answer === "") answer = [];
    if (!Array.isArray(answer)) answer = [answer];
    if (type === "calculation") {
      if (answer.length > 1 || answer.some(a => !Calculation.parse(a))) fail("计算题的正确结果应为一个整数、小数或分数，如 24、-3、0.5 或 1/2。");
      answer = answer.map(a => String(a).trim());
    } else if (type === "short") {
      if (answer.length > 1 || answer.some(a => typeof a !== "string")) fail("简答题的参考答案应是一段完整文字。");
      answer = answer.map(text).filter(Boolean);
    } else {
      answer = answer.map(a => {
        if (type === "boolean" && truth(a) !== null) {
          const matching = options.find(option => truth(option.text) === truth(a));
          return matching?.id || "?";
        }
        return text(a).toUpperCase();
      }).filter(Boolean);
      if (answer.some(a => !options.some(option => option.id === a))) fail("答案必须对应现有选项，请重新选择。");
      answer = [...new Set(answer)].sort();
      if (type !== "multiple" && answer.length > 1) fail("单选题和判断题只能有一个正确答案。");
      if (type === "multiple" && answer.length === 1) fail("多选题请至少选择两个正确答案，或改为单选题。");
    }
    if (requireAnswer && !answer.length) fail("AI 未提供有效答案，请重新生成。");
    if (answer.some(a => a.length > 10000)) fail("参考答案最多 10,000 字。");
    const explanation = text(raw.explanation);
    if (explanation.length > 10000) fail("解析最多 10,000 字。");
    return { id: `q${index + 1}`, ...Object.fromEntries(["grade","categoryId","categoryName"].filter(k => ["string","number"].includes(typeof raw[k])).map(k => [k, String(raw[k]).slice(0,100)])), type, ...(type === "calculation" && raw.kind === "application" ? { kind: "application" } : {}), stem, options, answer, explanation };
  }
  function fromAI(content, expectedCount) {
    if (typeof content !== "string" || !content.trim()) throw Error("AI 返回了空内容，请重试。");
    let data;
    try { data = JSON.parse(content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1")); }
    catch { throw Error("AI 返回的 JSON 不完整或格式不正确，请减少题数后重试。"); }
    if (!data || Array.isArray(data) || !Array.isArray(data.questions) || !data.questions.length || data.questions.length > LIMIT) throw Error(`AI 题库需要包含 1–${LIMIT} 道题的 questions 数组，请分批生成。`);
    const questions = data.questions.map((q, i) => normalizeQuestion(q, i, { requireAnswer: true }));
    const warnings = [];
    if (expectedCount && questions.length !== expectedCount) warnings.push(`请求了 ${expectedCount} 题，AI 实际生成 ${questions.length} 题；请核对后开始练习。`);
    if (new Set(questions.map(q => q.stem)).size < questions.length) warnings.push("有重复题干，请检查并删除不需要的题目。");
    MathReview.audit(questions, warnings);
    return { title: text(data.title).slice(0, 60) || "AI 专属练习", questions, warnings, source: "ai" };
  }
  function toJSON(questions, title) {
    return JSON.stringify({ title, questions: questions.map(({ type, kind, stem, options, answer, explanation, grade, categoryId, categoryName }) => ({ type, ...(grade ? {grade} : {}), ...(categoryId ? {categoryId} : {}), ...(categoryName ? {categoryName} : {}), ...(type === "calculation" && kind === "application" ? { kind } : {}), question: stem, options, answer, explanation })) }, null, 2);
  }
  const api = { normalizeQuestion, fromAI, toJSON, LIMIT };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizBank = api;
})(typeof window !== "undefined" ? window : globalThis);
