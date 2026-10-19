(function(root) {
  "use strict";
  const Calculation = typeof module === "object" && module.exports ? require("./calculation.js") : root.QuizCalculation;
  const MathReview = typeof module === "object" && module.exports ? require("./math-review.js") : root.QuizMathReview;
  const LIMIT = 1500;
  const text = (v) => v == null ? "" : String(v).trim();
  const unique = (values) => [...new Set(values)].sort();
  const clean = (v) => text(v).replace(/\*\*|__/g, "").replace(/^#{1,6}\s*/, "");
  const fullWidth = (s) => s.replace(/[Ａ-Ｈａ-ｈ０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248));
  const truth = (v) => /^(正确|对|是|true|t|yes|√|✓)$/i.test(text(v)) ? "A" : /^(错误|错|否|false|f|no|×|✗)$/i.test(text(v)) ? "B" : null;
  const key = (v) => text(v).toLowerCase().replace(/[\s_\-：:]/g, "");
  function value(row, names) {
    for (const k of names) if (row[k] !== void 0 && row[k] !== "") return row[k];
    return "";
  }
  function normalize(raw, index, warnings) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      warnings.push(`第 ${index + 1} 行不是有效题目，已跳过。`);
      return null;
    }
    const row = Object.fromEntries(Object.entries(raw).map(([k, v]) => [key(k), v]));
    let stem = text(value(row, ["stem", "question", "title", "题目", "题干", "问题"]));
    if (!stem) {
      warnings.push(`第 ${index + 1} 行缺少题干，已跳过。`);
      return null;
    }
    let type = text(value(row, ["type", "题型", "类型"]));
    const marker = stem.match(/^[【\[（(](单选题?|多选题?|判断题?|简答题?|填空题?|计算题?)[】\]）)]\s*/);
    if (marker) {
      type = type || marker[1];
      stem = stem.slice(marker[0].length);
    }
    let options = value(row, ["options", "choices", "选项"]);
    if (typeof options === "string" && /^[\[{]/.test(options)) {
      try {
        options = JSON.parse(options);
      } catch {
        options = [];
      }
    }
    if (!options) options = "ABCDEFGH".split("").filter((k) => row[k.toLowerCase()] || row["选项" + k.toLowerCase()]).map((k) => ({ id: k, text: row[k.toLowerCase()] || row["选项" + k.toLowerCase()] }));
    else if (!Array.isArray(options) && typeof options === "object") options = Object.entries(options).map(([id, v]) => ({ id, text: v }));
    if (!Array.isArray(options)) options = [];
    options = options.map((o, i) => typeof o === "object" && o !== null ? { id: text(o.id || o.label || String.fromCharCode(65 + i)).toUpperCase(), text: text(o.text ?? o.value ?? o.content) } : { id: String.fromCharCode(65 + i), text: text(o).replace(/^[A-H][.、:：)）]\s*/i, "") }).filter((o) => o.text);
    if (new Set(options.map((o) => o.id)).size !== options.length) {
      warnings.push(`第 ${index + 1} 题有重复选项编号，已重新编号，请核对答案。`);
      options.forEach((o, i) => {
        o.id = String.fromCharCode(65 + i);
      });
    }
    let answer = value(row, ["answer", "answers", "correctanswer", "correct", "答案", "正确答案", "参考答案", "标准答案"]);
    const answerText = Array.isArray(answer) ? answer.map(text).join("、") : text(answer);
    const bool = truth(answerText);
    if (/计算|calculation/i.test(type)) {
      type = "calculation";
      options = [];
    } else if (/简答|填空|short|text|essay/i.test(type)) {
      type = "short";
    } else if (/判断|boolean|truefalse/i.test(type) || !options.length && bool) {
      type = "boolean";
      if (!options.length) options = [{ id: "A", text: "正确" }, { id: "B", text: "错误" }];
    } else if (/简答|填空|short|text|essay/i.test(type) || !options.length) type = "short";
    else type = /多选|multiple|multi/i.test(type) ? "multiple" : "single";
    if (type === "calculation") {
      answer = answerText && Calculation.parse(answerText) ? [answerText] : [];
      if (answerText && !answer.length) warnings.push(`第 ${index + 1} 题的计算答案不是有效数值，请在预览中填写正确结果；暂按无答案题练习。`);
    } else if (type === "short") answer = answerText ? [answerText] : [];
    else if (type === "boolean" && bool) {
      const matching = options.find((o) => truth(o.text) === bool);
      answer = matching ? [matching.id] : [];
      if (!matching) warnings.push(`第 ${index + 1} 题的判断答案与选项不匹配，将按无答案题练习。`);
    } else {
      let a = fullWidth(answerText).replace(/^[【\[](.*)[】\]]$/, "$1").trim();
      if (/^[A-H\s,、，;；|/]+$/i.test(a)) answer = unique(a.toUpperCase().match(/[A-H]/g) || []);
      else {
        const found = options.find((o) => o.text === a);
        answer = found ? [found.id] : [];
        if (a) warnings.push(`第 ${index + 1} 题的答案无法匹配选项，将按无答案题练习。`);
      }
      if (answer.some((a2) => !options.some((o) => o.id === a2))) {
        warnings.push(`第 ${index + 1} 题的答案引用了不存在的选项，将按无答案题练习。`);
        answer = [];
      }
      if (answer.length > 1) type = "multiple";
    }
    if (options.length === 1) warnings.push(`第 ${index + 1} 题只有一个选项，请检查格式。`);
    return { id: `q${index + 1}`, ...Object.fromEntries(["grade","categoryId","categoryName"].filter(k => ["string","number"].includes(typeof row[k.toLowerCase()])).map(k => [k, String(row[k.toLowerCase()]).slice(0,100)])), type, ...(type === "calculation" && value(row, ["kind"]) === "application" ? { kind: "application" } : {}), stem, options, answer, explanation: text(value(row, ["explanation", "analysis", "解析", "答案解析", "解释"])) };
  }
  function finish(raw, warnings = []) {
    if (raw.length > LIMIT) throw Error(`题目超过 ${LIMIT} 道，请分批导入。`);
    const questions = raw.map((q, i) => normalize(q, i, warnings)).filter(Boolean);
    if (!questions.length) throw Error("没有识别到题目。请使用「1. 题目」编号，或参考右侧的题库格式。");
    const seen = /* @__PURE__ */ new Set();
    let duplicate = 0;
    for (const q of questions) {
      if (seen.has(q.stem)) duplicate++;
      seen.add(q.stem);
    }
    if (duplicate) warnings.push(`发现 ${duplicate} 道题干重复的题目，已保留，请确认是否需要。`);
    MathReview.audit(questions, warnings);
    return { questions, warnings };
  }
  function parseJSON(input) {
    let data;
    try {
      data = typeof input === "string" ? JSON.parse(input.replace(/^\uFEFF/, "")) : input;
    } catch {
      throw Error("JSON 格式有误，请检查逗号、引号和括号。");
    }
    const list = Array.isArray(data) ? data : data?.questions || data?.题目 || data?.items;
    if (!Array.isArray(list)) throw Error("JSON 应为题目数组，或包含 questions 数组。");
    return finish(list);
  }
  function parseRows(rows) {
    rows = rows.filter((row) => row.some((v) => text(v)));
    if (!rows.length) throw Error("表格中没有内容。");
    const headers = rows[0].map(key);
    if (!headers.some((h) => ["question", "stem", "title", "题目", "题干", "问题"].includes(h))) throw Error("表格第一行需要「题目」或 question 表头，可添加 A、B、C、D、答案、解析等列。");
    return finish(rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))));
  }
  function parseCSV(input) {
    const first = input.split(/\r?\n/)[0];
    const delimiter = first.includes("	") ? "	" : ",";
    const rows = [];
    let row = [], cell = "", quoted = false;
    input = input.replace(/^\uFEFF/, "");
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === '"') {
        if (quoted && input[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (quoted || !cell) quoted = !quoted;
        else cell += c;
      } else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
        row.push(cell);
        cell = "";
        if (c !== delimiter) {
          rows.push(row);
          row = [];
          if (c === "\r" && input[i + 1] === "\n") i++;
        }
      } else cell += c;
    }
    if (quoted) throw Error("CSV 中有未闭合的双引号，请检查文件。");
    row.push(cell);
    rows.push(row);
    return parseRows(rows);
  }
  function parseText(input) {
    if (text(input).length > 2e6) throw Error("文本过长，请按章节分批导入。");
    input = text(input).replace(/^\uFEFF/, "").replace(/^```[^\n]*\n?|^```\s*$/gm, "").trim();
    if (!input) throw Error("请先粘贴题库内容或选择文件。");
    if (input.startsWith("{") || /^\[\s*\{/.test(input)) return parseJSON(input);
    const firstLine = input.split("\n")[0];
    if (/[,\t]/.test(firstLine) && firstLine.split(/[,\t]/).some((h) => ["question", "stem", "title", "题目", "题干", "问题"].includes(key(h.replace(/^"|"$/g, ""))))) return parseCSV(input);
    if (/^\|.*(?:题目|question|题干).*\|/im.test(input)) {
      const rows = input.split("\n").filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*:?-{2,}/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map(text));
      return parseRows(rows);
    }
    const raw = [], warnings = [];
    let current = null, mode = "stem", option = null, answerKey = false;
    const keys = /* @__PURE__ */ new Map();
    function flush() {
      if (current) {
        raw.push(current);
        current = null;
      }
    }
    const start = /^(?:第\s*(\d+)\s*题[.、:：]?\s*|[（(](\d+)[）)]\s*|(\d+)[.、)）]\s*|(?:题目|问题|Question|Q)\s*(\d*)\s*[:：.]\s*)(.*)$/i;
    const lines = input.replace(/\r\n?/g, "\n").split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      let line = lines[lineIndex];
      line = clean(line).replace(/^[-*]\s+/, "");
      if (!line || /^[-=_]{3,}$/.test(line) || /^```/.test(line)) continue;
      line = fullWidth(line);
      if (/^(?:参考答案|答案汇总|答案汇总及解析|答案与解析|答案表|Answer key)\s*[:：]?$/i.test(line) && raw.length + !!current >= 1 && (!/[:：]$/.test(line) || /^\s*(?:第\s*)?\d+\s*(?:题)?[.、:：)）]/.test(lines.slice(lineIndex + 1).find((l) => l.trim()) || ""))) {
        flush();
        answerKey = true;
        continue;
      }
      if (answerKey) {
        const numeric = line.match(/^(?:第\s*)?(\d+)\s*(?:题)?[.、:：)）]\s*(.*?)\s*$/);
        if (numeric && Calculation.parse(numeric[2])) {
          keys.set(numeric[1], numeric[2]);
          continue;
        }
        const matches = [...line.matchAll(/(?:第\s*)?(\d+)\s*(?:题)?[.、:：)）]\s*([A-H](?:[A-H\s,、]*[A-H])?|正确|错误|对|错|true|false|√|×)(?=\s*\d+[.、:：)）]|$)/gi)];
        for (const m2 of matches) keys.set(m2[1], m2[2].trim());
        if (!matches.length) warnings.push(`答案汇总中未能识别「${line.slice(0, 45)}」，请核对。`);
        continue;
      }
      const m = line.match(start);
      if (m) {
        let looksLikeQuestion = /[?？]|^[【\[(（]|^(请|简述|解释|描述|列举|说明|谈谈)/.test(m[5]);
        if (current && !looksLikeQuestion && ["explanation", "stem"].includes(mode)) {
          for (let j = lineIndex + 1; j < lines.length; j++) {
            const next = fullWidth(clean(lines[j]));
            if (start.test(next)) break;
            if (/^[A-H][.、):：]|^(正确答案|参考答案|答案|Answer)\s*[:：]/i.test(next)) {
              looksLikeQuestion = true;
              break;
            }
          }
          if (!looksLikeQuestion && (mode === "explanation" || /^\s+/.test(lines[lineIndex]))) {
            current[mode] += (current[mode] ? "\n" : "") + line;
            continue;
          }
        }
        const number = m[1] || m[2] || m[3] || m[4] || String(raw.length + 1);
        if (current && Number(number) <= Number(current.number)) warnings.push(`题号 ${number} 重复或倒退，请在预览中核对题目分段。`);
        flush();
        current = { number, stem: m[5], options: [], answer: "", explanation: "" };
        mode = "stem";
        option = null;
        continue;
      }
      if (!current) continue;
      const answerMatch = line.match(/^(?:正确答案|参考答案|标准答案|答案|Answer|Correct answer)\s*[:：]\s*(.*)$/i);
      const explanationMatch = line.match(/^(?:答案解析|解析|解答|解释|Explanation|Analysis)\s*[:：]\s*(.*)$/i);
      if (answerMatch) {
        const parts = answerMatch[1].split(/\s*(?:解析|解释|Explanation)\s*[:：]\s*/i);
        current.answer = parts.shift();
        if (parts.length) {
          current.explanation = parts.join(" ");
          mode = "explanation";
        } else mode = "answer";
        continue;
      }
      if (explanationMatch) {
        current.explanation = explanationMatch[1];
        mode = "explanation";
        continue;
      }
      const opts = [...line.matchAll(/(?:^|\s+)([A-H])[.、)）:：]\s*/g)];
      if (opts.length && mode !== "explanation" && mode !== "answer") {
        opts.forEach((o, i) => {
          option = { id: o[1], text: line.slice(o.index + o[0].length, opts[i + 1]?.index).trim() };
          current.options.push(option);
        });
        mode = "option";
        continue;
      }
      if (mode === "option" && option) option.text += "\n" + line;
      else if (mode === "answer") current.answer += (current.answer ? " " : "") + line;
      else if (mode === "explanation") current.explanation += (current.explanation ? "\n" : "") + line;
      else current.stem += "\n" + line;
    }
    flush();
    if (!raw.length && /\t|,/.test(input.split("\n")[0])) return parseCSV(input);
    for (const q of raw) if (keys.has(q.number)) q.answer = keys.get(q.number);
    for (const k of keys.keys()) if (!raw.some((q) => q.number === k)) warnings.push(`答案表的第 ${k} 题未找到对应题目。`);
    return finish(raw, warnings);
  }
  function grade(question, selected) {
    if (question.type === "calculation") {
      if (!Calculation.parse(selected)) throw Error("请输入有效的计算结果，如 24、-3、0.5 或 1/2，不要填写算式或单位。");
      if (!question.answer.length) return "ungraded";
      return Calculation.equals(selected, question.answer[0]) ? "correct" : "incorrect";
    }
    if (!question.answer.length) return "ungraded";
    if (question.type === "short") return "review";
    return JSON.stringify(unique(Array.isArray(selected) ? selected : [selected])) === JSON.stringify(unique(question.answer)) ? "correct" : "incorrect";
  }
  const api = { parseText, parseJSON, parseCSV, parseRows, normalize, grade, LIMIT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.QuizParser = api;
})(typeof window !== "undefined" ? window : globalThis);
