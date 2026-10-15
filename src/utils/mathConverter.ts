import {
  Math,
  MathRun,
  MathFraction,
  MathRadical,
  MathSuperScript,
  MathSubScript,
  MathRoundBrackets,
  MathSquareBrackets,
  XmlComponent,
} from "docx";
import katex from "katex";

/**
 * Concrete XmlComponent subclass for arbitrary XML elements
 */
class CustomXmlComponent extends XmlComponent {
  constructor(tag: string, ...children: any[]) {
    super(tag);
    for (const child of children) {
      if (child !== undefined && child !== null) {
        this.root.push(child);
      }
    }
  }

  public addChild(...children: any[]): void {
    for (const c of children) {
      if (c !== undefined && c !== null) {
        this.root.push(c);
      }
    }
  }
}

/**
 * Native OMML Equation Array for Systems of Equations / Inequalities
 * Produces valid Office Math Markup Language (OMML) with:
 * - A single stretching opening brace '{' on the left
 * - No closing brace on the right (endChr="")
 * - Vertically stacked equation rows using <m:eqArr>
 * - Optional red color styling (<w:color w:val="DC2626"/>)
 */
export class OmmlCases extends XmlComponent {
  constructor(lines: string[], isRed = false) {
    super("m:oMath");
    const begChr = new CustomXmlComponent("m:begChr", { _attr: { "m:val": "{" } });
    const endChr = new CustomXmlComponent("m:endChr", { _attr: { "m:val": "" } });
    const grow = new CustomXmlComponent("m:grow", { _attr: { "m:val": "1" } });
    const dPr = new CustomXmlComponent("m:dPr", begChr, endChr, grow);

    const eqArr = new CustomXmlComponent("m:eqArr");
    for (const line of lines) {
      const lineElem = new CustomXmlComponent("m:e");
      const r = new CustomXmlComponent("m:r");
      if (isRed) {
        const color = new CustomXmlComponent("w:color", { _attr: { "w:val": "DC2626" } });
        const wrPr = new CustomXmlComponent("w:rPr", color);
        const rPr = new CustomXmlComponent("m:rPr", wrPr);
        r.addChild(rPr);
      }
      const t = new CustomXmlComponent("m:t", line);
      r.addChild(t);
      lineElem.addChild(r);
      eqArr.addChild(lineElem);
    }

    const e = new CustomXmlComponent("m:e", eqArr);
    const d = new CustomXmlComponent("m:d", dPr, e);
    this.root.push(d);
  }
}

/**
 * Native OMML Formula Component with optional red color styling
 */
export class OmmlFormula extends XmlComponent {
  constructor(text: string, isRed = false) {
    super("m:oMath");
    const r = new CustomXmlComponent("m:r");
    if (isRed) {
      const color = new CustomXmlComponent("w:color", { _attr: { "w:val": "DC2626" } });
      const wrPr = new CustomXmlComponent("w:rPr", color);
      const rPr = new CustomXmlComponent("m:rPr", wrPr);
      r.addChild(rPr);
    }
    const t = new CustomXmlComponent("m:t", text);
    r.addChild(t);
    this.root.push(r);
  }
}

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

  // 0. Systems of equations / cases: \begin{cases} ... \end{cases}
  s = s.replace(/\\begin\{cases\}([\s\S]+?)\\end\{cases\}/g, (_, inner) => {
    const lines = inner.split(/\\\\|\\cr/).map((l: string) => l.replace(/&/g, " ").trim()).filter(Boolean);
    return `{ ${lines.join("; ")} }`;
  });
  s = s.replace(/\\left\\{([\s\S]+?)(?:\\right[.\}]|$)/g, (_, inner) => {
    const lines = inner.split(/\\\\|\\cr/).map((l: string) => l.replace(/&/g, " ").trim()).filter(Boolean);
    return `{ ${lines.join("; ")} }`;
  });

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

  // 3b. Vectors and lines
  s = s.replace(/\\vec\{([^{}]+)\}/g, "$1⃗");
  s = s.replace(/\\overline\{([^{}]+)\}/g, "$1");

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

  // 6. Left and right brackets & delimiters
  s = s.replace(/\\left\s*([(\[{|])/g, "$1");
  s = s.replace(/\\right\s*([)\]}|])/g, "$1");
  s = s.replace(/\\left\./g, "");
  s = s.replace(/\\right\./g, "");
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

  // 10. Clean LaTeX formatting commands and spaces
  s = s.replace(/\\displaystyle\b/g, "");
  s = s.replace(/\\limits\b/g, "");
  s = s.replace(/\\quad/g, "  ").replace(/\\qquad/g, "    ").replace(/\\,/g, " ").replace(/\\;/g, " ").replace(/\\:/g, " ");
  s = s.replace(/\\/g, ""); // strip any leftover backslashes

  return s;
}

/**
 * Converts a math expression to a native Word Math component (docx.Math or OmmlCases)
 * Uses native MathFraction, MathRadical, MathSuperScript, MathSubScript,
 * MathRoundBrackets, MathSquareBrackets, and custom OmmlCases when possible,
 * generating true OMML Equations editable directly in Microsoft Word.
 */
export function convertLatexToDocxMath(formula: string, isRed = false): Math | XmlComponent {
  let clean = formula.trim();

  // Strip wrapping math delimiters
  if (clean.startsWith("$$") && clean.endsWith("$$")) clean = clean.slice(2, -2).trim();
  else if (clean.startsWith("$") && clean.endsWith("$")) clean = clean.slice(1, -1).trim();
  else if (clean.startsWith("\\[") && clean.endsWith("\\]")) clean = clean.slice(2, -2).trim();
  else if (clean.startsWith("\\(") && clean.endsWith("\\)")) clean = clean.slice(2, -2).trim();

  // Case 0: System of equations/inequalities \begin{cases} ... \end{cases} or \left\{ ... \right.
  const casesMatch =
    clean.match(/\\begin\{cases\}([\s\S]+?)\\end\{cases\}/) ||
    clean.match(/\\left\\{([\s\S]+?)(?:\\right[.\}]|\$|$)/);
  if (casesMatch) {
    const rawLines = casesMatch[1].split(/\\\\|\\cr/);
    const parsedLines: string[] = [];
    rawLines.forEach((line) => {
      const cleanLine = latexToUnicode(line.replace(/&/g, " ").trim());
      if (cleanLine) {
        parsedLines.push(cleanLine);
      }
    });
    if (parsedLines.length === 0) {
      parsedLines.push(latexToUnicode(casesMatch[1]));
    }
    return new OmmlCases(parsedLines, isRed);
  }

  // Case 1: Simple fraction \frac{a}{b}
  const fracMatch = clean.match(/^\\frac\{([^{}]+)\}\{([^{}]+)\}$/);
  if (fracMatch) {
    const num = latexToUnicode(fracMatch[1]);
    const den = latexToUnicode(fracMatch[2]);
    if (isRed) {
      return new OmmlFormula(`(${num})/(${den})`, true);
    }
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
    if (isRed) {
      return new OmmlFormula(`√(${inner})`, true);
    }
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
    if (isRed) {
      return new OmmlFormula(`${base}${latexToUnicode('^' + exp)}`, true);
    }
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
    if (isRed) {
      return new OmmlFormula(`${base}${latexToUnicode('_' + sub)}`, true);
    }
    return new Math({
      children: [
        new MathSubScript({
          children: [new MathRun(base)],
          subScript: [new MathRun(latexToUnicode(sub))],
        }),
      ],
    });
  }

  // Case 5: Round brackets \left( ... \right)
  const roundMatch = clean.match(/^\\left\(([\s\S]+?)\\right\)$/);
  if (roundMatch) {
    if (isRed) {
      return new OmmlFormula(`(${latexToUnicode(roundMatch[1])})`, true);
    }
    return new Math({
      children: [
        new MathRoundBrackets({
          children: [new MathRun(latexToUnicode(roundMatch[1]))],
        }),
      ],
    });
  }

  // Case 6: Square brackets \left[ ... \right]
  const squareMatch = clean.match(/^\\left\[([\s\S]+?)\\right\]$/);
  if (squareMatch) {
    if (isRed) {
      return new OmmlFormula(`[${latexToUnicode(squareMatch[1])}]`, true);
    }
    return new Math({
      children: [
        new MathSquareBrackets({
          children: [new MathRun(latexToUnicode(squareMatch[1]))],
        }),
      ],
    });
  }

  // General Case: Native Word Math Component (OMML) rendered with Cambria Math
  // Word's Math component automatically applies Cambria Math formatting, italicizing variables
  // and ensuring professional typography as an editable Equation.
  const unicodeMath = latexToUnicode(clean);
  if (isRed) {
    return new OmmlFormula(unicodeMath, true);
  }
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
    /\\begin\{cases\}[\s\S]+?\\end\{cases\}/.test(text) ||
    /\\frac\{[^{}]+\}\{[^{}]+\}/.test(text) ||
    /\\sqrt\{[^{}]+\}/.test(text) ||
    /\b(?:\\alpha|\\beta|\\gamma|\\Delta|\\pi|\\theta|\\Omega|\\lambda|\\mu|\\sigma|\\pm|\\times|\\le|\\leq|\\ge|\\geq|\\approx|\\neq|\\in|\\subset|\\cup|\\cap)\b/.test(text)
  );
}
