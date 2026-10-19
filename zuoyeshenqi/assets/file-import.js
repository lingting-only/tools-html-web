(function() {
  "use strict";
  const loads = /* @__PURE__ */ new Map();
  const base = new URL(".", document.currentScript?.src || document.baseURI);
  const embeddedAssets = document.getElementById("quiz-embedded-assets");
  const available = {
    "mammoth.browser.min.js": () => Boolean(window.mammoth?.convertToHtml),
    "xlsx.full.min.js": () => Boolean(window.XLSX?.read),
    "pdf.bundle.js": () => Boolean(window.LocalPDF?.getDocument && window.PDFAssets)
  };
  let embeddedSources;
  function script(name) {
    if (available[name]?.()) return Promise.resolve();
    if (!loads.has(name)) loads.set(name, new Promise((resolve, reject) => {
      const el = document.createElement("script");
      if (embeddedAssets) {
        try {
          embeddedSources ||= JSON.parse(embeddedAssets.textContent);
          if (!embeddedSources[name]) throw Error("缺少内置组件");
          const bytes = Uint8Array.from(atob(embeddedSources[name]), (char) => char.charCodeAt(0));
          el.textContent = new TextDecoder().decode(bytes);
          document.head.append(el);
          el.remove();
          if (!available[name]?.()) throw Error("组件未能初始化");
          resolve();
        } catch {
          el.remove();
          reject(Error("内置文件读取组件加载失败，请重新下载完整的 HTML 文件。"));
        }
        return;
      }
      el.src = new URL("vendor/" + name, base).href;
      el.onload = resolve;
      el.onerror = () => {
        loads.delete(name);
        el.remove();
        reject(Error("文件读取组件加载失败，请确认 assets 文件夹完整。"));
      };
      document.head.append(el);
    }).catch((error) => {
      loads.delete(name);
      throw error;
    }));
    return loads.get(name);
  }
  function decode(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder("utf-16le").decode(bytes);
    if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder("utf-16be").decode(bytes);
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("gb18030").decode(bytes);
    }
  }
  function wordText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let questionNumber = 0;
    const lines = [];
    function walk(node, depth = 0) {
      if (node.nodeType === 3) {
        if (node.textContent.trim()) lines.push(node.textContent.trim());
        return;
      }
      const tag = node.tagName;
      if (tag === "OL" || tag === "UL") {
        let optionNumber = 0;
        for (const item of node.children) {
          if (item.tagName !== "LI") continue;
          const prefix = depth === 0 ? `${++questionNumber}. ` : `${String.fromCharCode(65 + optionNumber++)}. `;
          const textNodes = Array.from(item.childNodes).filter((n) => !["OL", "UL"].includes(n.tagName));
          const body = textNodes.map((n) => n.textContent.trim()).filter(Boolean).join("\n");
          lines.push(prefix + body);
          for (const child of item.children) if (["OL", "UL"].includes(child.tagName)) walk(child, depth + 1);
        }
      } else if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "PRE"].includes(tag)) lines.push(node.textContent);
      else for (const child of node.childNodes) walk(child, depth);
    }
    walk(doc.body);
    return lines.join("\n");
  }
  async function pdfText(buffer, onProgress) {
    await script("pdf.bundle.js");
    class EmbeddedPdfDataFactory {
      async fetch({ kind, filename }) {
        const encoded = window.PDFAssets[kind]?.[filename];
        if (!encoded) throw Error(`缺少 PDF 字体资源：${filename}`);
        return Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      }
    }
    const task = window.LocalPDF.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, useWasm: false, useWorkerFetch: false, enableXfa: false, cMapPacked: true, BinaryDataFactory: EmbeddedPdfDataFactory });
    let pdf;
    try {
      pdf = await task.promise;
      if (pdf.numPages > 250) throw Error("PDF 超过 250 页，请按章节拆分后导入。");
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgress?.(`正在读取 PDF，第 ${i} / ${pdf.numPages} 页…`);
        const page = await pdf.getPage(i), content = await page.getTextContent();
        let lastY = null, line = "";
        const lines = [];
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5];
          if (lastY !== null && Math.abs(lastY - y) > 4 && line) {
            lines.push(line);
            line = "";
          }
          line += item.str + (item.hasEOL ? "" : " ");
          lastY = y;
          if (item.hasEOL) {
            lines.push(line);
            line = "";
            lastY = null;
          }
        }
        if (line) lines.push(line);
        pages.push(lines.join("\n"));
        page.cleanup();
      }
      const value = pages.join("\n");
      if (value.trim().length < 10) throw Error("这份 PDF 没有可提取的文字，可能是扫描件。请先转为文字或使用 TXT、Word 文件。");
      return value;
    } catch (err) {
      if (err.name === "PasswordException") throw Error("PDF 已加密，请先解除密码保护再导入。");
      throw err;
    } finally {
      await task.destroy();
    }
  }
  async function read(file, onProgress) {
    if (file.size > 15 * 1024 * 1024) throw Error("文件超过 15 MB，请拆分后再导入。");
    if (!file.size) throw Error("文件为空。");
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["txt", "md", "markdown", "json", "csv", "tsv", "xlsx", "xls", "docx", "pdf"].includes(ext)) throw Error(ext === "doc" ? "旧版 .doc 暂不支持，请另存为 .docx。" : "不支持此格式，请选择 TXT、MD、JSON、CSV、Excel、DOCX 或 PDF。");
    const buffer = await file.arrayBuffer();
    const P = window.QuizParser;
    if (ext === "docx") {
      await script("mammoth.browser.min.js");
      const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer }, { convertImage: window.mammoth.images.imgElement(() => Promise.resolve({ src: "" })) });
      const html = result.value.replace(/<br\s*\/?>/gi, "\n");
      const doc = new DOMParser().parseFromString(html, "text/html");
      const tables = Array.from(doc.querySelectorAll("table"));
      if (tables.length && tables.some((table) => /题目|题干|question/i.test(table.rows[0]?.textContent || ""))) {
        const questions = [], warnings = [];
        for (const table of tables) {
          try {
            const result2 = P.parseRows(Array.from(table.rows, (row) => Array.from(row.cells, (cell) => cell.textContent)));
            questions.push(...result2.questions);
            warnings.push(...result2.warnings);
          } catch (err) {
            warnings.push(`Word 表格未导入：${err.message}`);
          }
        }
        if (questions.length) return { questions, warnings };
      }
      return P.parseText(wordText(html));
    }
    if (ext === "pdf") return P.parseText(await pdfText(buffer, onProgress));
    if (ext === "xls" || ext === "xlsx") {
      await script("xlsx.full.min.js");
      const book = window.XLSX.read(buffer, { type: "array" }), questions = [], warnings = [];
      for (const name of book.SheetNames) {
        const rows = window.XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "", raw: false });
        if (!rows.some((r) => r.some((v) => String(v).trim()))) continue;
        try {
          const result = P.parseRows(rows);
          questions.push(...result.questions);
          warnings.push(...result.warnings.map((w) => `${name}：${w}`));
        } catch (err) {
          warnings.push(`工作表「${name}」未导入：${err.message}`);
        }
      }
      if (!questions.length) throw Error(warnings.join("\n") || "表格中没有题目。");
      return { questions, warnings };
    }
    const value = decode(buffer);
    return ext === "json" ? P.parseJSON(value) : ["csv", "tsv"].includes(ext) ? P.parseCSV(value) : P.parseText(value);
  }
  window.QuizFiles = { read };
})();
