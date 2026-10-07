import {
  Math,
  MathRun,
  MathFraction,
  MathRadical,
  MathSuperScript,
  MathSubScript,
} from "docx";
import katex from "katex";

/**
 * Greek letters dictionary
 */
const GREEK_LETTERS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  Gamma: "Γ",
  delta: "δ",
  Delta: "Δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  Theta: "Θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  Lambda: "Λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  Xi: "Ξ",
  pi: "π",
  Pi: "Π",
  rho: "ρ",
  sigma: "σ",
  Sigma: "Σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  Phi: "Φ",
  chi: "χ",
  psi: "ψ",
  Psi: "Ψ",
  omega: "ω",
  Omega: "Ω",
};

/**
 * Math symbols dictionary
 */
const MATH_SYMBOLS: Record<string, string> = {
  times: "×",
  cdot: "·",
  div: "÷",
  pm: "±",
  mp: "∓",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  infty: "∞",
  propto: "∝",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  forall: "∀",
  exists: "∃",
  to: "→",
  rightarrow: "→",
  Leftarrow: "⇐",
  Rightarrow: "⇒",
  leftrightarrow: "↔",
  Leftrightarrow: "⇔",
  degree: "°",
  circ: "°",
  angle: "∠",
  triangle: "△",
  perp: "⊥",
  parallel: "∥",
};

/**
 * Superscript unicode mapping
 */
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ", "x": "ˣ", "y": "ʸ",
};

/**
 * Subscript unicode mapping
 */
const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ",
  "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
  "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ",
  "v": "ᵥ", "x": "ₓ",
};

/**
 * Converts a LaTeX formula into clean Unicode text
 * e.g. \frac{-b \pm \sqrt{\Delta}}{2a} -> (-b ± √Δ)/(2a)
 * e.g. x^2 + y^2 = R^2 -> x² + y² = R²
 */
export function latexToUnicode(latex: string): string {
  if (!latex) return "";
  let s = latex.trim();

  // Strip wrapping delimiters $...$, $$...$$, \(...\), \[...\]
  if (s.startsWith("$$") && s.endsWith("$$")) s = s.slice(2, -2).trim();
  else if (s.startsWith("$") && s.endsWith("$")) s = s.slice(1, -1).trim();
  else if (s.startsWith("\\[") && s.endsWith("\\]")) s = s.slice(2, -2).trim();
  else if (s.startsWith("\\(") && s.endsWith("\\)")) s = s.slice(2, -2).trim();

  // 1. Text wrappers \text{...}, \mathrm{...}, \mathbf{...}, \mathit{...}
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|textit)\{([^{}]+)\}/g, "$1");

  // 2. Fractions: \frac{a}{b} -> (a)/(b) or simple a/b
  let fracCount = 0;
  while (s.includes("\\frac") && fracCount < 10) {
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
    fracCount++;
  }

  // 3. Square roots: \sqrt{x} -> √(x) or \sqrt[n]{x} -> ⁿ√(x)
  s = s.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, "($1)√($2)");
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");

  // 4. Greek letters
  for (const [key, val] of Object.entries(GREEK_LETTERS)) {
    const re = new RegExp(`\\\\${key}\\b`, "g");
    s = s.replace(re, val);
  }

  // 5. Math symbols
  for (const [key, val] of Object.entries(MATH_SYMBOLS)) {
    const re = new RegExp(`\\\\${key}\\b`, "g");
    s = s.replace(re, val);
  }

  // 6. Left and right brackets
  s = s.replace(/\\left\s*([(\[{|])/g, "$1");
  s = s.replace(/\\right\s*([)\]}|])/g, "$1");
  s = s.replace(/\\\{/g, "{").replace(/\\\}/g, "}");

  // 7. Superscripts with braces: ^{2} or ^2
  s = s.replace(/\^\{([0-9+\-nixy=()]+)\}/g, (_, inner) => {
    return inner.split("").map((c: string) => SUPERSCRIPTS[c] || `^${c}`).join("");
  });
  s = s.replace(/\^([0-9+\-nixy])/g, (_, c) => SUPERSCRIPTS[c] || `^${c}`);

  // 8. Subscripts with braces: _{1} or _1
  s = s.replace(/_\{([0-9+\-aehijklmnoprstuvx=()]+)\}/g, (_, inner) => {
    return inner.split("").map((c: string) => SUBSCRIPTS[c] || `_${c}`).join("");
  });
  s = s.replace(/_([0-9+\-aehijklmnoprstuvx])/g, (_, c) => SUBSCRIPTS[c] || `_${c}`);

  // 9. Clean remaining braces from LaTeX grouping
  s = s.replace(/\{([^{}]+)\}/g, "$1");

  // 10. Clean multiple spaces
  s = s.replace(/\\quad/g, "  ").replace(/\\qquad/g, "    ").replace(/\\,/g, " ");
  s = s.replace(/\\/g, ""); // strip any leftover backslashes

  return s;
}

/**
 * Converts a math expression to a native Word Math component (docx.Math)
 * Uses native MathFraction, MathRadical, MathSuperScript, MathSubScript when possible,
 * and formats using the standard Word Equation font (Cambria Math).
 */
export function convertLatexToDocxMath(formula: string): Math {
  let clean = formula.trim();

  // Strip wrapping math delimiters
  if (clean.startsWith("$$") && clean.endsWith("$$")) clean = clean.slice(2, -2).trim();
  else if (clean.startsWith("$") && clean.endsWith("$")) clean = clean.slice(1, -1).trim();
  else if (clean.startsWith("\\[") && clean.endsWith("\\]")) clean = clean.slice(2, -2).trim();
  else if (clean.startsWith("\\(") && clean.endsWith("\\)")) clean = clean.slice(2, -2).trim();

  // Case 1: Simple fraction \frac{a}{b}
  const fracMatch = clean.match(/^\\frac\{([^{}]+)\}\{([^{}]+)\}$/);
  if (fracMatch) {
    const num = latexToUnicode(fracMatch[1]);
    const den = latexToUnicode(fracMatch[2]);
    return new Math({
      children: [
        new MathFraction({
          numerator: [new MathRun(num)],
          denominator: [new MathRun(den)],
        }),
      ],
    });
  }

  // Case 2: Square root \sqrt{x}
  const sqrtMatch = clean.match(/^\\sqrt\{([^{}]+)\}$/);
  if (sqrtMatch) {
    const inner = latexToUnicode(sqrtMatch[1]);
    return new Math({
      children: [
        new MathRadical({
          children: [new MathRun(inner)],
        }),
      ],
    });
  }

  // Case 3: Simple superscript x^2 or x^{2}
  const superMatch = clean.match(/^([a-zA-Z0-9]+)\^(?:\{([^{}]+)\}|([0-9a-zA-Z]+))$/);
  if (superMatch) {
    const base = superMatch[1];
    const exp = superMatch[2] || superMatch[3];
    return new Math({
      children: [
        new MathSuperScript({
          children: [new MathRun(base)],
          superScript: [new MathRun(latexToUnicode(exp))],
        }),
      ],
    });
  }

  // Case 4: Simple subscript x_1 or x_{1}
  const subMatch = clean.match(/^([a-zA-Z0-9]+)_(?:\{([^{}]+)\}|([0-9a-zA-Z]+))$/);
  if (subMatch) {
    const base = subMatch[1];
    const sub = subMatch[2] || subMatch[3];
    return new Math({
      children: [
        new MathSubScript({
          children: [new MathRun(base)],
          subScript: [new MathRun(latexToUnicode(sub))],
        }),
      ],
    });
  }

  // General Case: Convert to clean Unicode mathematical text rendered inside Word Math
  // Word's Math component automatically applies Cambria Math formatting, italicizing variables
  // and ensuring professional typography.
  const unicodeMath = latexToUnicode(clean);
  return new Math({
    children: [new MathRun(unicodeMath)],
  });
}

/**
 * Renders LaTeX formula to HTML using KaTeX for high-fidelity web preview
 */
export function renderLatexToHtml(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode,
    });
  } catch (err) {
    console.warn("KaTeX render error:", err);
    // Fallback to formatted Unicode string
    return `<span class="font-serif italic text-slate-800">${latexToUnicode(latex)}</span>`;
  }
}

/**
 * Checks if a line or segment contains mathematical formulas or LaTeX syntax
 */
export function containsMath(text: string): boolean {
  if (!text) return false;
  return (
    /\$\$[\s\S]+?\$\$/.test(text) ||
    /\$[^$]+?\$/.test(text) ||
    /\\\(.+?\\\)/.test(text) ||
    /\\\[[\s\S]+?\\\]/.test(text) ||
    /\\frac\{[^{}]+\}\{[^{}]+\}/.test(text) ||
    /\\sqrt\{[^{}]+\}/.test(text) ||
    /\b(?:\\alpha|\\beta|\\gamma|\\Delta|\\pi|\\theta|\\Omega|\\lambda|\\mu|\\sigma|\\pm|\\times|\\le|\\ge|\\approx|\\neq)\b/.test(text)
  );
}
