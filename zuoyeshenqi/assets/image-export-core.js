(function(root) {
  "use strict";
  const WIDTH = 1080, HEIGHT = 1440, LINE_HEIGHT = 34;
  const FONTS = { number: 18, stem: 28, option: 26, answers: 24, explanation: 24 };
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "grapheme" }) : null;
  function wrapText(value, maxWidth, measure) {
    const text = String(value ?? "").replace(/\r\n?/g, "\n"), result = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      // Keep ordinary numbers intact so a wrapped calculation never turns 15 into 1 / 5.
      const characters = (paragraph.match(/\d+(?:\.\d+)?|[^\d]+/gu) || []).flatMap(part => {
        if (/^\d/.test(part) && measure(part) <= maxWidth) return [part];
        return segmenter ? Array.from(segmenter.segment(part), item => item.segment) : Array.from(part);
      });
      for (const character of characters) {
        if (line && measure(line + character) > maxWidth) { result.push(line); line = character; }
        else line += character;
      }
      result.push(line);
    }
    return result;
  }
  function answerText(question, value) {
    if (value == null || value === "" || Array.isArray(value) && !value.length) return "未作答";
    if (!Array.isArray(value)) return String(value);
    return value.map(answer => {
      const option = question.options?.find(option => option.id === answer);
      return option ? option.id : String(answer);
    }).join("；");
  }
  function layout(session, { includeAnswers = true, measure } = {}) {
    if (!session?.questions?.length) throw Error("没有可导出的练习题。");
    if (typeof measure !== "function") throw Error("无法测量图片文字。");
    const margin = 56, gap = 28, columnWidth = (WIDTH - margin * 2 - gap) / 2;
    const top = 306, rowGap = 16, baseHeight = 40, cards = [];
    session.questions.forEach((question, questionIndex) => {
      const lines = [];
      const number = String(questionIndex + 1).padStart(2, "0");
      const numberWidth = Math.max(42, Math.ceil(measure(number, FONTS.number)) + 16);
      const stemOffset = numberWidth + 12;
      const add = (value, kind) => {
        for (const text of wrapText(value, columnWidth - 48 - (kind === "stem" ? stemOffset : 0), value => measure(value, FONTS[kind]))) lines.push({ text, kind });
      };
      add(question.stem, "stem");
      for (const option of question.options || []) add(`${option.id}. ${option.text}`, "option");
      if (includeAnswers) {
        const response = session.responses?.[questionIndex];
        const ownAnswer = answerText(question, response?.value);
        const correctAnswer = question.answer?.length ? answerText(question, question.answer) : "未提供";
        add(`我的作答：${ownAnswer}　${question.type === "short" ? "参考答案" : "正确答案"}：${correctAnswer}`, "answers");
        if (question.explanation) add(`解析：${question.explanation}`, "explanation");
      }
      cards.push({ questionIndex, number, numberWidth, stemOffset, continued: false, lines, width: columnWidth, height: baseHeight + lines.length * LINE_HEIGHT });
    });
    const pages = [];
    for (let start = 0; start < cards.length; start += 30) {
      const group = cards.slice(start, start + 30), page = { cards: [] };
      let y = top;
      for (let i = 0; i < group.length; i += 2) {
        const row = group.slice(i, i + 2);
        row.forEach((card, column) => page.cards.push({ ...card, x: margin + column * (columnWidth + gap), y }));
        y += Math.max(...row.map(card => card.height)) + rowGap;
      }
      page.height = Math.max(HEIGHT, y - rowGap + 80);
      pages.push(page);
    }
    return { pages, width: WIDTH, height: HEIGHT, totalQuestions: session.questions.length };
  }
  function safeName(title) {
    return String(title || "练习题").replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "-").replace(/^[.\s-]+|[.\s-]+$/g, "").slice(0, 70) || "练习题";
  }
  const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
    return (crc ^ 0xffffffff) >>> 0;
  }
  // PNG is already compressed. A standard uncompressed ZIP avoids dependencies.
  function createZip(entries) {
    if (entries.length > 65535) throw Error("导出的图片数量过多，请分批导出。");
    const encoder = new TextEncoder();
    const files = entries.map(entry => ({ name: encoder.encode(entry.name), bytes: entry.bytes, crc: crc32(entry.bytes) }));
    const localSize = files.reduce((size, file) => size + 30 + file.name.length + file.bytes.length, 0);
    const directorySize = files.reduce((size, file) => size + 46 + file.name.length, 0);
    if (localSize + directorySize + 22 > 0xffffffff || files.some(file => file.name.length > 65535)) throw Error("图片包过大，请分批导出。");
    const bytes = new Uint8Array(localSize + directorySize + 22), view = new DataView(bytes.buffer);
    const u16 = (offset, value) => view.setUint16(offset, value, true), u32 = (offset, value) => view.setUint32(offset, value, true);
    let offset = 0, central = localSize;
    for (const file of files) {
      u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x0800); u16(offset + 12, 0x21);
      u32(offset + 14, file.crc); u32(offset + 18, file.bytes.length); u32(offset + 22, file.bytes.length); u16(offset + 26, file.name.length);
      bytes.set(file.name, offset + 30); bytes.set(file.bytes, offset + 30 + file.name.length);
      u32(central, 0x02014b50); u16(central + 4, 20); u16(central + 6, 20); u16(central + 8, 0x0800); u16(central + 14, 0x21);
      u32(central + 16, file.crc); u32(central + 20, file.bytes.length); u32(central + 24, file.bytes.length); u16(central + 28, file.name.length); u32(central + 42, offset);
      bytes.set(file.name, central + 46);
      offset += 30 + file.name.length + file.bytes.length; central += 46 + file.name.length;
    }
    u32(central, 0x06054b50); u16(central + 8, files.length); u16(central + 10, files.length);
    u32(central + 12, directorySize); u32(central + 16, localSize);
    return bytes;
  }
  const api = { wrapText, layout, safeName, createZip, FONTS, LINE_HEIGHT };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizImageExportCore = api;
})(typeof window !== "undefined" ? window : globalThis);
