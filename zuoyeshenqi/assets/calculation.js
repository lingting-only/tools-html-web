(function(root) {
  "use strict";
  // Exact rational arithmetic avoids rounding large integers or close decimals.
  // Only numeric results are accepted; never evaluate an entered expression.
  function decimal(value) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^[+-]/, "").split(".");
    return { numerator: BigInt((whole || "0") + fraction) * (negative ? -1n : 1n), denominator: 10n ** BigInt(fraction.length) };
  }
  function parse(value) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    const raw = String(value);
    if (!raw.trim() || raw.length > 120) return null;
    const parts = raw.normalize("NFKC").replace(/[−﹣]/g, "-").replace(/[⁄∕]/g, "/").trim().split("/");
    if (parts.length > 2) return null;
    const first = decimal(parts[0].trim());
    if (!first) return null;
    if (parts.length === 1) return first;
    const second = decimal(parts[1].trim());
    if (!second || second.numerator === 0n) return null;
    return { numerator: first.numerator * second.denominator, denominator: first.denominator * second.numerator };
  }
  function equals(left, right) {
    const a = parse(left), b = parse(right);
    return Boolean(a && b && a.numerator * b.denominator === b.numerator * a.denominator);
  }
  const api = { parse, equals };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizCalculation = api;
})(typeof window !== "undefined" ? window : globalThis);
