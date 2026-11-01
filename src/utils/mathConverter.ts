import { XmlComponent } from "docx";
import katex from "katex";

export type MathOutputFormat = "equation" | "latex";

/**
 * Concrete XmlComponent subclass for arbitrary Office Open XML / OMML elements
 */
export class CustomXmlComponent extends XmlComponent {
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
  varphi: "φ",
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
  varnothing: "∅",
  forall: "∀",
  exists: "∃",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  Leftarrow: "⇐",
  Rightarrow: "⇒",
  implies: "⇒",
  leftrightarrow: "↔",
  Leftrightarrow: "⇔",
  iff: "⇔",
  degree: "°",
  circ: "°",
  angle: "∠",
  triangle: "△",
  perp: "⊥",
  parallel: "∥",
  dots: "…",
  ldots: "…",
  cdots: "⋯",
};

const BLACKBOARD_BOLD: Record<string, string> = {
  R: "ℝ",
  N: "ℕ",
  Z: "ℤ",
  Q: "ℚ",
  C: "ℂ",
};

const NARY_OPERATORS: Record<string, string> = {
  sum: "∑",
  prod: "∏",
  int: "∫",
  iint: "∬",
  oint: "∮",
  bigcup: "⋃",
  bigcap: "⋂",
};

const NAMED_FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "cot",
  "arcsin",
  "arccos",
  "arctan",
  "ln",
  "log",
  "lg",
  "min",
  "max",
  "gcd",
  "lcm",
  "det",
]);

/**
 * Superscript unicode mapping
 */
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ", "x": "ˣ", "y": "ʸ",
};

const UNICODE_SUPER_TO_ASCII: Record<string, string> = Object.fromEntries(
  Object.entries(SUPERSCRIPTS).map(([k, v]) => [v, k])
);

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

const UNICODE_SUB_TO_ASCII: Record<string, string> = Object.fromEntries(
  Object.entries(SUBSCRIPTS).map(([k, v]) => [v, k])
);

const UNICODE_TO_LATEX_MAP: Record<string, string> = {
  "≤": "\\le ",
  "≥": "\\ge ",
  "≠": "\\neq ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "±": "\\pm ",
  "∓": "\\mp ",
  "×": "\\times ",
  "÷": "\\div ",
  "·": "\\cdot ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "⊂": "\\subset ",
  "⊆": "\\subseteq ",
  "⊃": "\\supset ",
  "⊇": "\\supseteq ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "∅": "\\emptyset ",
  "∀": "\\forall ",
  "∃": "\\exists ",
  "ℝ": "\\mathbb{R}",
  "ℕ": "\\mathbb{N}",
  "ℤ": "\\mathbb{Z}",
  "ℚ": "\\mathbb{Q}",
  "ℂ": "\\mathbb{C}",
  "∞": "\\infty ",
  "→": "\\to ",
  "←": "\\leftarrow ",
  "⇒": "\\Rightarrow ",
  "⇐": "\\Leftarrow ",
  "⇔": "\\Leftrightarrow ",
  "↔": "\\leftrightarrow ",
  "⊥": "\\perp ",
  "∥": "\\parallel ",
  "∠": "\\angle ",
  "△": "\\triangle ",
  "°": "^\\circ",
  "π": "\\pi ",
  "Δ": "\\Delta ",
  "α": "\\alpha ",
  "β": "\\beta ",
  "γ": "\\gamma ",
  "δ": "\\delta ",
  "ε": "\\varepsilon ",
  "θ": "\\theta ",
  "λ": "\\lambda ",
  "μ": "\\mu ",
  "ρ": "\\rho ",
  "σ": "\\sigma ",
  "φ": "\\varphi ",
  "ω": "\\omega ",
  "Ω": "\\Omega ",
};

/**
 * Forbidden Unicode math characters in raw LaTeX mode per user specification:
 * (², √, π, ≤, ≠, ∈, ∞, →, Δ...)
 */
export const FORBIDDEN_UNICODE_MATH_REGEX =
  /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ√πΔαβγδεθλμρσφωΩ≤≥≠≈≡±∓×÷·∈∉⊂⊆⊃⊇∪∩∅∀∃ℝℕℤℚℂ∞→←⇒⇐⇔↔⊥∥∠△]/;

/**
 * Strips outer math delimiters ($...$, $$...$$, \(...\), \[...\])
 */
function stripOuterMathDelimiters(s: string): string {
  const t = s.trim();
  if (t.startsWith("$$") && t.endsWith("$$") && t.length >= 4) return t.slice(2, -2).trim();
  if (t.startsWith("$") && t.endsWith("$") && t.length >= 2) return t.slice(1, -1).trim();
  if (t.startsWith("\\[") && t.endsWith("\\]")) return t.slice(2, -2).trim();
  if (t.startsWith("\\(") && t.endsWith("\\)")) return t.slice(2, -2).trim();
  return t;
}

/**
 * Converts a LaTeX formula into clean Unicode text (used for plain-text fallback / copy)
 */
export function latexToUnicode(latex: string): string {
  if (!latex) return "";
  let s = stripOuterMathDelimiters(latex);

  // Decimal comma 2{,}5 -> 2,5
  s = s.replace(/(\d)\{,\}(\d)/g, "$1,$2");

  // 0. Systems of equations / cases
  s = s.replace(/\\begin\{cases\}([\s\S]+?)\\end\{cases\}/g, (_, inner) => {
    const lines = inner
      .split(/\\\\|\\cr/)
      .map((l: string) => l.replace(/&/g, " ").trim())
      .filter(Boolean);
    return `{ ${lines.join("; ")} }`;
  });
  s = s.replace(/\\left\\\{([\s\S]+?)(?:\\right[.\}]|$)/g, (_, inner) => {
    const lines = inner
      .split(/\\\\|\\cr/)
      .map((l: string) => l.replace(/&/g, " ").trim())
      .filter(Boolean);
    return `{ ${lines.join("; ")} }`;
  });

  // 1. Blackboard bold \mathbb{R}
  s = s.replace(/\\mathbb\{([RNZQC])\}/g, (_, ch: string) => BLACKBOARD_BOLD[ch] || ch);

  // 2. Text wrappers
  s = s.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|textit)\{([^{}]*)\}/g, "$1");

  // 3. Fractions
  let fracCount = 0;
  while (/\\(?:d|t)?frac/.test(s) && fracCount < 10) {
    s = s.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
    fracCount++;
  }

  // 4. Radicals
  s = s.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, "($1)√($2)");
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");

  // 5. Vectors, hats, overlines
  s = s.replace(/\\(?:overrightarrow|vec)\{([^{}]+)\}/g, "$1⃗");
  s = s.replace(/\\(?:widehat|hat)\{([^{}]+)\}/g, "$1̂");
  s = s.replace(/\\(?:overline|bar)\{([^{}]+)\}/g, "$1");

  // 6. Degrees 30^\circ or 30^{\circ}
  s = s.replace(/\^\{\\circ\}/g, "°").replace(/\^\\circ\b/g, "°");

  // 7. Greek letters & Math symbols
  for (const [key, val] of Object.entries(GREEK_LETTERS)) {
    s = s.replace(new RegExp(`\\\\${key}\\b`, "g"), val);
  }
  for (const [key, val] of Object.entries(MATH_SYMBOLS)) {
    s = s.replace(new RegExp(`\\\\${key}\\b`, "g"), val);
  }

  // 8. Delimiters
  s = s.replace(/\\left\s*([(\[{|])/g, "$1");
  s = s.replace(/\\right\s*([)\]}|])/g, "$1");
  s = s.replace(/\\left\./g, "").replace(/\\right\./g, "");
  s = s.replace(/\\\{/g, "{").replace(/\\\}/g, "}");

  // 9. Superscripts & Subscripts
  s = s.replace(/\^\{([0-9+\-nixy=()]+)\}/g, (_, inner) =>
    inner.split("").map((c: string) => SUPERSCRIPTS[c] || `^${c}`).join("")
  );
  s = s.replace(/\^([0-9+\-nixy])/g, (_, c) => SUPERSCRIPTS[c] || `^${c}`);
  s = s.replace(/_\{([0-9+\-aehijklmnoprstuvx=()]+)\}/g, (_, inner) =>
    inner.split("").map((c: string) => SUBSCRIPTS[c] || `_${c}`).join("")
  );
  s = s.replace(/_([0-9+\-aehijklmnoprstuvx])/g, (_, c) => SUBSCRIPTS[c] || `_${c}`);

  // 10. Clean remaining braces and spacing commands
  s = s.replace(/\{([^{}]+)\}/g, "$1");
  s = s.replace(/\\(?:displaystyle|limits)\b/g, "");
  s = s
    .replace(/\\quad/g, "  ")
    .replace(/\\qquad/g, "    ")
    .replace(/\\[,;:!]/g, " ");
  s = s.replace(/\\/g, "");

  return s;
}

// ============================================================================
// PART 1: FULL RECURSIVE LATEX -> OMML COMPILER (FOR 'equation' MODE)
// ============================================================================

type OmmlAtom =
  | { kind: "text"; text: string; normal?: boolean }
  | { kind: "node"; comp: CustomXmlComponent };

function makeOmmlVal(tag: string, val: string | number): CustomXmlComponent {
  return new CustomXmlComponent(tag, { _attr: { "m:val": String(val) } });
}

function makeOmmlRun(text: string, isRed = false, isNormalText = false): CustomXmlComponent {
  const r = new CustomXmlComponent("m:r");
  if (isNormalText) {
    r.addChild(new CustomXmlComponent("m:rPr", makeOmmlVal("m:nor", 1)));
  }
  const wrPr = new CustomXmlComponent(
    "w:rPr",
    new CustomXmlComponent("w:rFonts", {
      _attr: { "w:ascii": "Cambria Math", "w:hAnsi": "Cambria Math" },
    })
  );
  if (isRed) {
    wrPr.addChild(new CustomXmlComponent("w:color", { _attr: { "w:val": "DC2626" } }));
  }
  r.addChild(wrPr);
  r.addChild(new CustomXmlComponent("m:t", { _attr: { "xml:space": "preserve" } }, text));
  return r;
}

function atomsToOmmlComponents(atoms: OmmlAtom[], isRed: boolean): CustomXmlComponent[] {
  const result: CustomXmlComponent[] = [];
  let buf = "";
  let bufNormal = false;

  const flush = () => {
    if (buf.length > 0) {
      result.push(makeOmmlRun(buf, isRed, bufNormal));
      buf = "";
    }
  };

  for (const atom of atoms) {
    if (atom.kind === "text") {
      const norm = !!atom.normal;
      if (buf.length > 0 && bufNormal !== norm) {
        flush();
      }
      bufNormal = norm;
      buf += atom.text;
    } else {
      flush();
      result.push(atom.comp);
    }
  }
  flush();

  if (result.length === 0) {
    result.push(makeOmmlRun(" ", isRed, false));
  }
  return result;
}

function atomToElementChildren(atom: OmmlAtom, isRed: boolean): CustomXmlComponent[] {
  if (atom.kind === "node") return [atom.comp];
  return [makeOmmlRun(atom.text, isRed, !!atom.normal)];
}

function makeOmmlFraction(num: CustomXmlComponent[], den: CustomXmlComponent[]): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:f",
    new CustomXmlComponent("m:num", ...num),
    new CustomXmlComponent("m:den", ...den)
  );
}

function makeOmmlRadical(radicand: CustomXmlComponent[], degree?: CustomXmlComponent[]): CustomXmlComponent {
  if (degree && degree.length > 0) {
    return new CustomXmlComponent(
      "m:rad",
      new CustomXmlComponent("m:radPr", makeOmmlVal("m:degHide", 0)),
      new CustomXmlComponent("m:deg", ...degree),
      new CustomXmlComponent("m:e", ...radicand)
    );
  }
  return new CustomXmlComponent(
    "m:rad",
    new CustomXmlComponent("m:radPr", makeOmmlVal("m:degHide", 1)),
    new CustomXmlComponent("m:deg"),
    new CustomXmlComponent("m:e", ...radicand)
  );
}

function makeOmmlSup(base: CustomXmlComponent[], sup: CustomXmlComponent[]): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:sSup",
    new CustomXmlComponent("m:sSupPr"),
    new CustomXmlComponent("m:e", ...base),
    new CustomXmlComponent("m:sup", ...sup)
  );
}

function makeOmmlSub(base: CustomXmlComponent[], sub: CustomXmlComponent[]): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:sSub",
    new CustomXmlComponent("m:sSubPr"),
    new CustomXmlComponent("m:e", ...base),
    new CustomXmlComponent("m:sub", ...sub)
  );
}

function makeOmmlSubSup(
  base: CustomXmlComponent[],
  sub: CustomXmlComponent[],
  sup: CustomXmlComponent[]
): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:sSubSup",
    new CustomXmlComponent("m:sSubSupPr"),
    new CustomXmlComponent("m:e", ...base),
    new CustomXmlComponent("m:sub", ...sub),
    new CustomXmlComponent("m:sup", ...sup)
  );
}

function makeOmmlDelimiter(
  beg: string,
  end: string,
  inner: CustomXmlComponent[],
  grow = true
): CustomXmlComponent {
  const dPr = new CustomXmlComponent(
    "m:dPr",
    makeOmmlVal("m:begChr", beg),
    makeOmmlVal("m:endChr", end),
    ...(grow ? [makeOmmlVal("m:grow", 1)] : [])
  );
  return new CustomXmlComponent("m:d", dPr, new CustomXmlComponent("m:e", ...inner));
}

function makeOmmlAccent(accentChar: string, inner: CustomXmlComponent[]): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:acc",
    new CustomXmlComponent("m:accPr", makeOmmlVal("m:chr", accentChar)),
    new CustomXmlComponent("m:e", ...inner)
  );
}

function makeOmmlBar(inner: CustomXmlComponent[], pos: "top" | "bot" = "top"): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:bar",
    new CustomXmlComponent("m:barPr", makeOmmlVal("m:pos", pos)),
    new CustomXmlComponent("m:e", ...inner)
  );
}

function makeOmmlCasesFromRows(rows: CustomXmlComponent[][]): CustomXmlComponent {
  const eqArr = new CustomXmlComponent("m:eqArr", new CustomXmlComponent("m:eqArrPr"));
  for (const row of rows) {
    eqArr.addChild(new CustomXmlComponent("m:e", ...row));
  }
  return makeOmmlDelimiter("{", "", [eqArr], true);
}

function makeOmmlEqArrOnly(rows: CustomXmlComponent[][]): CustomXmlComponent {
  const eqArr = new CustomXmlComponent("m:eqArr", new CustomXmlComponent("m:eqArrPr"));
  for (const row of rows) {
    eqArr.addChild(new CustomXmlComponent("m:e", ...row));
  }
  return eqArr;
}

function makeOmmlNary(
  chr: string,
  sub: CustomXmlComponent[] | null,
  sup: CustomXmlComponent[] | null,
  body: CustomXmlComponent[]
): CustomXmlComponent {
  const naryPr = new CustomXmlComponent(
    "m:naryPr",
    makeOmmlVal("m:chr", chr),
    makeOmmlVal("m:subHide", sub ? 0 : 1),
    makeOmmlVal("m:supHide", sup ? 0 : 1)
  );
  return new CustomXmlComponent(
    "m:nary",
    naryPr,
    new CustomXmlComponent("m:sub", ...(sub || [])),
    new CustomXmlComponent("m:sup", ...(sup || [])),
    new CustomXmlComponent("m:e", ...body)
  );
}

function makeOmmlLimLow(funcName: string, limSub: CustomXmlComponent[], isRed: boolean): CustomXmlComponent {
  return new CustomXmlComponent(
    "m:limLow",
    new CustomXmlComponent("m:e", makeOmmlRun(funcName, isRed, true)),
    new CustomXmlComponent("m:lim", ...limSub)
  );
}

/**
 * Reads a balanced {...} group starting at idx (where src[idx] === '{').
 */
function readBracedGroup(src: string, idx: number): { content: string; nextIdx: number } {
  if (src[idx] !== "{") {
    return { content: src[idx] || "", nextIdx: idx + 1 };
  }
  let depth = 0;
  let i = idx;
  const start = idx + 1;
  while (i < src.length) {
    if (src[i] === "\\" && i + 1 < src.length) {
      i += 2;
      continue;
    }
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        return { content: src.slice(start, i), nextIdx: i + 1 };
      }
    }
    i++;
  }
  return { content: src.slice(start), nextIdx: src.length };
}

/**
 * Reads a balanced [...] optional argument starting at idx (where src[idx] === '[').
 */
function readBracketGroup(src: string, idx: number): { content: string; nextIdx: number } {
  let depth = 0;
  let i = idx;
  const start = idx + 1;
  while (i < src.length) {
    if (src[i] === "\\" && i + 1 < src.length) {
      i += 2;
      continue;
    }
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        return { content: src.slice(start, i), nextIdx: i + 1 };
      }
    }
    i++;
  }
  return { content: src.slice(start), nextIdx: src.length };
}

/**
 * Pre-normalizes Unicode superscripts/subscripts & decimal commas before OMML AST compilation
 */
function preprocessForOmmlParser(raw: string): string {
  let s = stripOuterMathDelimiters(raw);
  s = s.replace(/(\d)\{,\}(\d)/g, "$1,$2");
  s = s.replace(/\^\{\\circ\}/g, "°").replace(/\^\\circ\b/g, "°");
  s = s.replace(/<=|=< /g, "\\le ").replace(/>=/g, "\\ge ").replace(/!=/g, "\\neq ");

  // Convert runs of Unicode superscripts (e.g. x² -> x^{2}) into explicit LaTeX ^{...}
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸ]+/g, (m) => {
    const ascii = m.split("").map((c) => UNICODE_SUPER_TO_ASCII[c] || c).join("");
    return `^{${ascii}}`;
  });

  // Convert runs of Unicode subscripts (e.g. x₀ -> x_{0}) into explicit LaTeX _{...}
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g, (m) => {
    const ascii = m.split("").map((c) => UNICODE_SUB_TO_ASCII[c] || c).join("");
    return `_{${ascii}}`;
  });

  return s;
}

/**
 * Reads a single script argument (after ^ or _)
 */
function readScriptArg(
  src: string,
  idx: number,
  isRed: boolean
): { nodes: CustomXmlComponent[]; nextIdx: number } {
  let i = idx;
  while (i < src.length && src[i] === " ") i++;
  if (i >= src.length) {
    return { nodes: [makeOmmlRun("", isRed)], nextIdx: i };
  }
  if (src[i] === "{") {
    const grp = readBracedGroup(src, i);
    return { nodes: compileLatexToOmmlChildren(grp.content, isRed), nextIdx: grp.nextIdx };
  }
  if (src[i] === "\\") {
    const cmdMatch = src.slice(i + 1).match(/^[a-zA-Z]+/);
    if (cmdMatch) {
      const cmd = cmdMatch[0];
      const nextPos = i + 1 + cmd.length;
      return { nodes: compileLatexToOmmlChildren(`\\${cmd}`, isRed), nextIdx: nextPos };
    }
  }
  const ch = src[i];
  return { nodes: [makeOmmlRun(ch, isRed)], nextIdx: i + 1 };
}

/**
 * Recursive LaTeX -> OMML child element compiler
 */
export function compileLatexToOmmlChildren(rawLatex: string, isRed = false): CustomXmlComponent[] {
  const src = preprocessForOmmlParser(rawLatex);
  const atoms: OmmlAtom[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // 1. Superscript / Subscript attachment to previous atom
    if (ch === "^" || ch === "_") {
      const firstType = ch;
      const firstArg = readScriptArg(src, i + 1, isRed);
      i = firstArg.nextIdx;

      // Check if degrees: ^{\circ} -> °
      if (
        firstType === "^" &&
        firstArg.nodes.length === 1 &&
        JSON.stringify(firstArg.nodes[0]).includes('"°"')
      ) {
        atoms.push({ kind: "text", text: "°" });
        continue;
      }

      let secondType: "^" | "_" | null = null;
      let secondNodes: CustomXmlComponent[] | null = null;
      let peek = i;
      while (peek < src.length && src[peek] === " ") peek++;
      if (peek < src.length && (src[peek] === "^" || src[peek] === "_") && src[peek] !== firstType) {
        secondType = src[peek] as "^" | "_";
        const secondArg = readScriptArg(src, peek + 1, isRed);
        secondNodes = secondArg.nodes;
        i = secondArg.nextIdx;
      }

      const prevAtom = atoms.length > 0 ? atoms.pop()! : ({ kind: "text", text: "" } as OmmlAtom);
      const baseNodes = atomToElementChildren(prevAtom, isRed);

      if (secondType && secondNodes) {
        const subNodes = firstType === "_" ? firstArg.nodes : secondNodes;
        const supNodes = firstType === "^" ? firstArg.nodes : secondNodes;
        atoms.push({ kind: "node", comp: makeOmmlSubSup(baseNodes, subNodes, supNodes) });
      } else if (firstType === "^") {
        atoms.push({ kind: "node", comp: makeOmmlSup(baseNodes, firstArg.nodes) });
      } else {
        atoms.push({ kind: "node", comp: makeOmmlSub(baseNodes, firstArg.nodes) });
      }
      continue;
    }

    // 2. Braced group { ... }
    if (ch === "{") {
      const grp = readBracedGroup(src, i);
      const innerNodes = compileLatexToOmmlChildren(grp.content, isRed);
      if (innerNodes.length === 1) {
        atoms.push({ kind: "node", comp: innerNodes[0] });
      } else {
        // Wrap multi-element group in an invisible m:e-compatible container or push sequentially
        for (const n of innerNodes) {
          atoms.push({ kind: "node", comp: n });
        }
      }
      i = grp.nextIdx;
      continue;
    }

    // 3. Parenthesized group (...) -> keeps (x + 1)^2 properly grouped on base!
    if (ch === "(") {
      let depth = 0;
      let j = i;
      let foundClose = -1;
      while (j < src.length) {
        if (src[j] === "\\" && j + 1 < src.length) {
          j += 2;
          continue;
        }
        if (src[j] === "(") depth++;
        else if (src[j] === ")") {
          depth--;
          if (depth === 0) {
            foundClose = j;
            break;
          }
        }
        j++;
      }
      if (foundClose > i) {
        const innerStr = src.slice(i + 1, foundClose);
        const innerComp = compileLatexToOmmlChildren(innerStr, isRed);
        atoms.push({ kind: "node", comp: makeOmmlDelimiter("(", ")", innerComp, false) });
        i = foundClose + 1;
        continue;
      }
    }

    // 4. LaTeX Commands starting with '\'
    if (ch === "\\") {
      // Escaped single symbol: \{, \}, \, , \; , \: , \! , \% , \& , \_
      const nextChar = src[i + 1] || "";
      if (nextChar === "{" || nextChar === "}") {
        atoms.push({ kind: "text", text: nextChar });
        i += 2;
        continue;
      }
      if (",;:! ".includes(nextChar)) {
        atoms.push({ kind: "text", text: " " });
        i += 2;
        continue;
      }
      if (nextChar === "%" || nextChar === "&" || nextChar === "_" || nextChar === "$") {
        atoms.push({ kind: "text", text: nextChar });
        i += 2;
        continue;
      }
      if (nextChar === "\\") {
        // Line break '\\' outside cases -> '; '
        atoms.push({ kind: "text", text: "; " });
        i += 2;
        continue;
      }

      const cmdMatch = src.slice(i + 1).match(/^[a-zA-Z]+/);
      if (!cmdMatch) {
        i += 1;
        continue;
      }
      const cmd = cmdMatch[0];
      i += 1 + cmd.length;

      // \begin{cases}...\end{cases} or \begin{aligned}...\end{aligned} or \begin{array}...\end{array}
      if (cmd === "begin") {
        while (i < src.length && src[i] === " ") i++;
        const envGrp = src[i] === "{" ? readBracedGroup(src, i) : { content: "", nextIdx: i };
        i = envGrp.nextIdx;
        const envName = envGrp.content.trim();
        // Skip optional column spec like {ll} in \begin{array}{ll}
        if (envName === "array" && src[i] === "{") {
          i = readBracedGroup(src, i).nextIdx;
        }
        const endTag = `\\end{${envName}}`;
        const endPos = src.indexOf(endTag, i);
        const bodyStr = endPos >= 0 ? src.slice(i, endPos) : src.slice(i);
        i = endPos >= 0 ? endPos + endTag.length : src.length;

        const rawRows = bodyStr
          .split(/\\\\|\\cr\b/)
          .map((r) => r.replace(/&/g, " ").trim())
          .filter(Boolean);
        const compiledRows = (rawRows.length > 0 ? rawRows : [bodyStr]).map((r) =>
          compileLatexToOmmlChildren(r, isRed)
        );

        if (envName.includes("cases")) {
          atoms.push({ kind: "node", comp: makeOmmlCasesFromRows(compiledRows) });
        } else {
          atoms.push({ kind: "node", comp: makeOmmlEqArrOnly(compiledRows) });
        }
        continue;
      }

      // \left ... \right
      if (cmd === "left") {
        while (i < src.length && src[i] === " ") i++;
        let begChr = "";
        if (src.slice(i, i + 2) === "\\{" || src.slice(i, i + 2) === "\\}") {
          begChr = src[i + 1];
          i += 2;
        } else if (src.slice(i, i + 6) === "\\lvert" || src.slice(i, i + 6) === "\\rvert") {
          begChr = "|";
          i += 6;
        } else {
          begChr = src[i] === "." ? "" : src[i] || "(";
          i += 1;
        }

        // Find matching \right
        let depth = 1;
        let scan = i;
        let matchRightStart = -1;
        let matchRightEnd = src.length;
        let endChr = "";

        while (scan < src.length) {
          if (src.slice(scan).startsWith("\\left") && !/[a-zA-Z]/.test(src[scan + 5] || "")) {
            depth++;
            scan += 5;
            continue;
          }
          if (src.slice(scan).startsWith("\\right") && !/[a-zA-Z]/.test(src[scan + 6] || "")) {
            depth--;
            if (depth === 0) {
              matchRightStart = scan;
              let rPos = scan + 6;
              while (rPos < src.length && src[rPos] === " ") rPos++;
              if (src.slice(rPos, rPos + 2) === "\\{" || src.slice(rPos, rPos + 2) === "\\}") {
                endChr = src[rPos + 1];
                matchRightEnd = rPos + 2;
              } else if (src.slice(rPos, rPos + 6) === "\\rvert" || src.slice(rPos, rPos + 6) === "\\lvert") {
                endChr = "|";
                matchRightEnd = rPos + 6;
              } else {
                endChr = src[rPos] === "." ? "" : src[rPos] || "";
                matchRightEnd = Math.min(src.length, rPos + 1);
              }
              break;
            }
            scan += 6;
            continue;
          }
          scan++;
        }

        const innerSlice = matchRightStart >= 0 ? src.slice(i, matchRightStart) : src.slice(i);
        i = matchRightStart >= 0 ? matchRightEnd : src.length;

        // If \left\{ contains \\ rows without \begin{array}, render as OmmlCases
        if (begChr === "{" && endChr === "" && /\\\\/.test(innerSlice) && !/\\begin\{/.test(innerSlice)) {
          const rows = innerSlice
            .split(/\\\\|\\cr\b/)
            .map((r) => r.replace(/&/g, " ").trim())
            .filter(Boolean)
            .map((r) => compileLatexToOmmlChildren(r, isRed));
          atoms.push({ kind: "node", comp: makeOmmlCasesFromRows(rows) });
        } else {
          const innerComp = compileLatexToOmmlChildren(innerSlice, isRed);
          atoms.push({ kind: "node", comp: makeOmmlDelimiter(begChr, endChr, innerComp, true) });
        }
        continue;
      }

      if (cmd === "right") {
        // Stray \right
        if (i < src.length && src[i] !== ".") {
          atoms.push({ kind: "text", text: src[i] });
        }
        i += 1;
        continue;
      }

      // \frac{num}{den}, \dfrac{num}{den}, \tfrac{num}{den}
      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac" || cmd === "cfrac") {
        while (i < src.length && src[i] === " ") i++;
        const numGrp = readBracedGroup(src, i);
        i = numGrp.nextIdx;
        while (i < src.length && src[i] === " ") i++;
        const denGrp = readBracedGroup(src, i);
        i = denGrp.nextIdx;
        const numComp = compileLatexToOmmlChildren(numGrp.content, isRed);
        const denComp = compileLatexToOmmlChildren(denGrp.content, isRed);
        atoms.push({ kind: "node", comp: makeOmmlFraction(numComp, denComp) });
        continue;
      }

      // \sqrt[deg]{expr} or \sqrt{expr}
      if (cmd === "sqrt") {
        while (i < src.length && src[i] === " ") i++;
        let degComp: CustomXmlComponent[] | undefined;
        if (src[i] === "[") {
          const degGrp = readBracketGroup(src, i);
          i = degGrp.nextIdx;
          degComp = compileLatexToOmmlChildren(degGrp.content, isRed);
        }
        while (i < src.length && src[i] === " ") i++;
        const radGrp = readBracedGroup(src, i);
        i = radGrp.nextIdx;
        const radComp = compileLatexToOmmlChildren(radGrp.content, isRed);
        atoms.push({ kind: "node", comp: makeOmmlRadical(radComp, degComp) });
        continue;
      }

      // Vectors & Accents: \overrightarrow{AB}, \vec{u}, \widehat{ABC}, \hat{x}, \tilde{x}
      if (cmd === "overrightarrow" || cmd === "vec") {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        atoms.push({
          kind: "node",
          comp: makeOmmlAccent("\u20D7", compileLatexToOmmlChildren(grp.content, isRed)),
        });
        continue;
      }
      if (cmd === "widehat" || cmd === "hat") {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        atoms.push({
          kind: "node",
          comp: makeOmmlAccent("\u0302", compileLatexToOmmlChildren(grp.content, isRed)),
        });
        continue;
      }
      if (cmd === "widetilde" || cmd === "tilde") {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        atoms.push({
          kind: "node",
          comp: makeOmmlAccent("\u0303", compileLatexToOmmlChildren(grp.content, isRed)),
        });
        continue;
      }
      if (cmd === "overline" || cmd === "bar") {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        atoms.push({
          kind: "node",
          comp: makeOmmlBar(compileLatexToOmmlChildren(grp.content, isRed), "top"),
        });
        continue;
      }
      if (cmd === "underline") {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        atoms.push({
          kind: "node",
          comp: makeOmmlBar(compileLatexToOmmlChildren(grp.content, isRed), "bot"),
        });
        continue;
      }

      // \mathbb{R}, \mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{C}
      if (cmd === "mathbb") {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        const key = grp.content.trim();
        atoms.push({ kind: "text", text: BLACKBOARD_BOLD[key] || key });
        continue;
      }

      // Text / upright font commands: \text{...}, \mathrm{...}, \textbf{...}
      if (
        cmd === "text" ||
        cmd === "mathrm" ||
        cmd === "textbf" ||
        cmd === "textit" ||
        cmd === "mathbf" ||
        cmd === "mathit" ||
        cmd === "operatorname"
      ) {
        while (i < src.length && src[i] === " ") i++;
        const grp = readBracedGroup(src, i);
        i = grp.nextIdx;
        const isNorm = cmd === "text" || cmd === "mathrm" || cmd === "textbf" || cmd === "operatorname";
        atoms.push({ kind: "text", text: grp.content, normal: isNorm });
        continue;
      }

      // \lim_{x \to 0}
      if (cmd === "lim") {
        while (i < src.length && src[i] === " ") i++;
        if (src[i] === "\\") {
          const limCmd = src.slice(i + 1).match(/^limits\b/);
          if (limCmd) i += 1 + limCmd[0].length;
        }
        while (i < src.length && src[i] === " ") i++;
        if (src[i] === "_") {
          const subArg = readScriptArg(src, i + 1, isRed);
          i = subArg.nextIdx;
          atoms.push({ kind: "node", comp: makeOmmlLimLow("lim", subArg.nodes, isRed) });
        } else {
          atoms.push({ kind: "text", text: "lim", normal: true });
        }
        continue;
      }

      // N-ary operators: \sum, \prod, \int, \bigcup, \bigcap
      if (NARY_OPERATORS[cmd]) {
        const chr = NARY_OPERATORS[cmd];
        let subNodes: CustomXmlComponent[] | null = null;
        let supNodes: CustomXmlComponent[] | null = null;

        for (let pass = 0; pass < 2; pass++) {
          while (i < src.length && src[i] === " ") i++;
          if (src.slice(i).startsWith("\\limits")) i += 7;
          while (i < src.length && src[i] === " ") i++;
          if (src[i] === "_" && !subNodes) {
            const arg = readScriptArg(src, i + 1, isRed);
            subNodes = arg.nodes;
            i = arg.nextIdx;
          } else if (src[i] === "^" && !supNodes) {
            const arg = readScriptArg(src, i + 1, isRed);
            supNodes = arg.nodes;
            i = arg.nextIdx;
          }
        }

        // Parse immediate operand term (up to + - = , ; or end)
        while (i < src.length && src[i] === " ") i++;
        let bodyEnd = i;
        let depth = 0;
        while (bodyEnd < src.length) {
          const c = src[bodyEnd];
          if (c === "{" || c === "(" || c === "[") depth++;
          else if (c === "}" || c === ")" || c === "]") {
            if (depth === 0) break;
            depth--;
          } else if (depth === 0 && (c === "+" || c === "-" || c === "=" || c === ";" || c === ",")) {
            if (bodyEnd > i) break;
          }
          bodyEnd++;
        }
        const bodySlice = src.slice(i, bodyEnd).trim();
        i = bodyEnd;
        const bodyNodes = bodySlice ? compileLatexToOmmlChildren(bodySlice, isRed) : [makeOmmlRun(" ", isRed)];
        atoms.push({ kind: "node", comp: makeOmmlNary(chr, subNodes, supNodes, bodyNodes) });
        continue;
      }

      // Named math functions: \sin, \cos, \tan, \ln, \log...
      if (NAMED_FUNCTIONS.has(cmd)) {
        atoms.push({ kind: "text", text: cmd, normal: true });
        if (i < src.length && /[a-zA-Z0-9]/.test(src[i])) {
          atoms.push({ kind: "text", text: " " });
        }
        continue;
      }

      // Spacing & display modifiers
      if (cmd === "displaystyle" || cmd === "textstyle" || cmd === "scriptstyle" || cmd === "limits" || cmd === "nolimits") {
        continue;
      }
      if (cmd === "quad") {
        atoms.push({ kind: "text", text: "  " });
        continue;
      }
      if (cmd === "qquad") {
        atoms.push({ kind: "text", text: "    " });
        continue;
      }
      if (cmd === "space" || cmd === "enspace") {
        atoms.push({ kind: "text", text: " " });
        continue;
      }

      // Greek letters & Math symbols
      if (GREEK_LETTERS[cmd]) {
        atoms.push({ kind: "text", text: GREEK_LETTERS[cmd] });
        if (i < src.length && src[i] === " ") i++;
        continue;
      }
      if (MATH_SYMBOLS[cmd]) {
        atoms.push({ kind: "text", text: MATH_SYMBOLS[cmd] });
        if (i < src.length && src[i] === " ") i++;
        continue;
      }

      // Unknown command fallback: render command name cleanly
      atoms.push({ kind: "text", text: cmd });
      continue;
    }

    // 5. Regular character (keep single char per atom so x^2 only attaches to 'x', not '2x')
    atoms.push({ kind: "text", text: ch });
    i++;
  }

  return atomsToOmmlComponents(atoms, isRed);
}

/**
 * Converts ANY LaTeX formula (simple or deeply nested compound formula)
 * into an authentic, editable Microsoft Word OMML <m:oMath> XmlComponent.
 */
export function convertLatexToDocxMath(formula: string, isRed = false): CustomXmlComponent {
  const children = compileLatexToOmmlChildren(formula, isRed);
  return new CustomXmlComponent("m:oMath", ...children);
}

/**
 * Safeguard for 'equation' mode: detects stray unwrapped math expressions in plain text slices
 * (e.g. "x ≥ 0", "2x + y ≤ 120", "F(x, y) = 3,5x + 2y", "A(0; 100)", "(x₀; y₀)", "Oxy")
 * and wraps them in $...$ so 100% of math in the document becomes OMML <m:oMath> objects.
 * Never touches VB 3456 indicator codes (1.1.NC1b), section numbers (2.1.), or Vietnamese prose.
 */
export function autoWrapUnwrappedMathForEquation(plainText: string): string {
  if (!plainText || !plainText.trim()) return plainText;

  // Protect indicator codes (e.g. 1.1.NC1b, 5.2.NC1b, NLS.GV-1) and [[...]] tokens
  const protectedTokens: string[] = [];
  let s = plainText.replace(
    /(\[\[(?:IMAGE|GEN_SVG|RED):[^\]]*\]\]|\b\d+\.\d+\.(?:CB|TC|NC)\d+[a-z]\b|\bNLS\.[A-Z0-9\-_]+\b)/gi,
    (m) => {
      const idx = protectedTokens.length;
      protectedTokens.push(m);
      return `@@PROT_${idx}@@`;
    }
  );

  const wrap = (expr: string) => {
    const idx = protectedTokens.length;
    protectedTokens.push(`$${expr.trim()}$`);
    return `@@PROT_${idx}@@`;
  };

  // 1. Braced system notation e.g. {x < 0; y ≥ 0} or {-2x + y < 3; 4x + 3y < 1}
  s = s.replace(/\{[^{}\n]{3,80}?(?:<=|>=|≤|≥|≠|<|>|=)[^{}\n]{1,80}?\}/g, (m) => wrap(m));

  // 2. Chained inequalities e.g. 0 ≤ x ≤ 1,6 or 0 <= y <= 1,1
  s = s.replace(
    /\b\d+(?:[.,]\d+)?\s*(?:<=|>=|≤|≥|<|>)\s*[a-zA-Z](?:_[0-9a-zA-Z]+|[₀-₉]+)?\s*(?:<=|>=|≤|≥|<|>)\s*\d+(?:[.,]\d+)?/g,
    (m) => wrap(m)
  );

  // 3. Function definitions / evaluations e.g. F(x, y) = 3,5x + 2y, F(B) = 3,5(20) + 2(80) = 230
  s = s.replace(
    /\b[A-Za-z]\s*\(\s*[A-Za-z0-9₀-₉]+(?:\s*[,;]\s*[A-Za-z0-9₀-₉]+)?\s*\)\s*(?:=\s*[+-]?[\d.,a-zA-Z₀-₉²³()+\-*/ ]+)+/g,
    (m) => {
      // Trim trailing spaces or punctuation
      const trailMatch = m.match(/([,.;:\s]+)$/);
      if (trailMatch) {
        const core = m.slice(0, m.length - trailMatch[1].length);
        return wrap(core) + trailMatch[1];
      }
      return wrap(m);
    }
  );

  // 4. Algebraic equations & inequalities e.g. 2x + y ≤ 120, x ≥ 0, -2x + y < 3, x + y = 5
  s = s.replace(
    /(?<![A-Za-zÀ-ỹ])(?:[+-]?\s*\d+(?:[.,]\d+)?\s*)?[a-zA-Z](?:_[0-9a-zA-Z]+|[₀-₉]+|[²³])?(?:\s*[+\-]\s*(?:\d+(?:[.,]\d+)?\s*)?[a-zA-Z0-9₀-₉²³]+)*\s*(?:<=|>=|≤|≥|≠|=|<|>)\s*[+-]?\s*\d+(?:[.,]\d+)?(?:\s*[+\-]\s*\d*(?:[.,]\d+)?[a-zA-Z₀-₉²³]*)*/g,
    (m) => wrap(m)
  );

  // 5. Coordinate points e.g. O(0; 0), A(0; 100), B(20; 80), M(x₀; y₀) and ordered pairs (x; y), (0,6; 0,7)
  s = s.replace(
    /\b[A-Z]\s*\(\s*[+-]?(?:\d+(?:[.,]\d+)?|[a-zA-Z](?:_[0-9a-zA-Z]+|[₀-₉]+)?)\s*;\s*[+-]?(?:\d+(?:[.,]\d+)?|[a-zA-Z](?:_[0-9a-zA-Z]+|[₀-₉]+)?)\s*\)/g,
    (m) => wrap(m)
  );
  s = s.replace(
    /\(\s*[+-]?(?:\d+(?:[.,]\d+)?|[a-zA-Z](?:_[0-9a-zA-Z]+|[₀-₉]+)?)\s*;\s*[+-]?(?:\d+(?:[.,]\d+)?|[a-zA-Z](?:_[0-9a-zA-Z]+|[₀-₉]+)?)\s*\)/g,
    (m) => wrap(m)
  );

  // 6. Tokens containing Unicode math superscripts/subscripts/symbols e.g. y², x₀, ℝ
  s = s.replace(
    /[A-Za-z0-9()]*[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉√≤≥≠±∈∉ℝℕℤℚℂ∞Δπ][A-Za-z0-9⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉()+\-=]*/g,
    (m) => wrap(m)
  );

  // 7. Coordinate system & axes names: Oxy, Ox, Oy
  s = s.replace(/\b(Oxy|Ox|Oy)\b/g, (m) => wrap(m));

  // Restore protected tokens (iterate twice because wrapped tokens may sit in protectedTokens)
  for (let pass = 0; pass < 2; pass++) {
    s = s.replace(/@@PROT_(\d+)@@/g, (_, idxStr) => protectedTokens[Number(idxStr)] ?? "");
  }

  return s;
}

// ============================================================================
// PART 2: STRICT RAW LATEX NORMALIZER (FOR 'latex' MODE)
// ============================================================================

/**
 * Enforces strict raw LaTeX conventions inside a single formula:
 * - Zero Unicode math symbols (², √, π, ≤, ≠, ∈, ∞, →, Δ...)
 * - Always curly braces on exponents and subscripts: x^{2}, a_{n}
 * - Uses \frac, \sqrt, \le, \ge, \in, \mathbb{R}, 30^\circ, decimal 2{,}5
 * - Single unbroken line
 */
export function enforceStrictRawLatexFormula(rawFormula: string): string {
  let f = stripOuterMathDelimiters(rawFormula).replace(/\r?\n/g, " ").trim();

  // 1. Convert Unicode square roots √(x) or √x -> \sqrt{x}
  f = f.replace(/√\(([^()]+)\)/g, "\\sqrt{$1}");
  f = f.replace(/√([a-zA-Z0-9]+)/g, "\\sqrt{$1}");

  // 2. Convert Unicode superscripts & subscripts into ^{...} and _{...}
  f = f.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸ]+/g, (m) => {
    const ascii = m.split("").map((c) => UNICODE_SUPER_TO_ASCII[c] || c).join("");
    return `^{${ascii}}`;
  });
  f = f.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g, (m) => {
    const ascii = m.split("").map((c) => UNICODE_SUB_TO_ASCII[c] || c).join("");
    return `_{${ascii}}`;
  });

  // 3. Convert remaining Unicode math symbols to strict LaTeX commands
  for (const [uni, cmd] of Object.entries(UNICODE_TO_LATEX_MAP)) {
    if (f.includes(uni)) {
      f = f.split(uni).join(cmd);
    }
  }

  // Normalize ASCII <=, >=, !=
  f = f.replace(/<=/g, "\\le ").replace(/>=/g, "\\ge ").replace(/!=/g, "\\neq ");

  // Normalize \leq -> \le, \geq -> \ge
  f = f.replace(/\\leq\b/g, "\\le").replace(/\\geq\b/g, "\\ge");

  // 4. Enforce curly braces on bare exponents & subscripts: x^2 -> x^{2}, a_n -> a_{n}
  // Note: leaves 30^\circ untouched because \circ begins with '\'
  f = f.replace(/\^([a-zA-Z0-9+\-])/g, "^{$1}");
  f = f.replace(/_([a-zA-Z0-9+\-])/g, "_{$1}");

  // 5. Enforce Vietnamese decimal comma in LaTeX: 2,5 -> 2{,}5 (avoiding _{1,2} subscript list)
  f = f.replace(/(?<!_\{\d*)(\d),(\d)/g, "$1{,}$2");

  // Clean excessive spaces
  f = f.replace(/\s{2,}/g, " ").trim();
  return f;
}

/**
 * Normalizes entire lesson plan markdown for 'latex' mode:
 * - Converts \[...\] -> $$...$$ and \(...\) -> $...$
 * - Normalizes every $...$ and $$...$$ with enforceStrictRawLatexFormula
 * - Ensures zero forbidden Unicode math characters exist anywhere (even outside $...$)
 */
export function normalizeContentForRawLatex(content: string): string {
  if (!content) return "";

  // 1. Convert \[...\] and \(...\) to $$...$$ and $...$
  let s = content
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => `$$${inner.replace(/\r?\n/g, " ").trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => `$${inner.replace(/\r?\n/g, " ").trim()}$`);

  // 2. Wrap bare \begin{cases}...\end{cases} if not already inside $...$ or $$...$$
  // We do a single pass over existing $$...$$ and $...$ tokens first
  const mathTokenRegex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let result = "";
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const cleanPlainSlice = (plain: string): string => {
    if (!plain) return plain;
    // Wrap any bare \begin{cases}...\end{cases}
    let p = plain.replace(/\\begin\{cases\}[\s\S]+?\\end\{cases\}/g, (m) => {
      return `$$${enforceStrictRawLatexFormula(m)}$$`;
    });
    // If any forbidden Unicode math characters leaked outside $...$, wrap & convert them!
    if (FORBIDDEN_UNICODE_MATH_REGEX.test(p)) {
      const autoWrapped = autoWrapUnwrappedMathForEquation(p);
      p = autoWrapped.replace(/\$([^$\n]+?)\$/g, (_, inner) => `$${enforceStrictRawLatexFormula(inner)}$`);
      // Final sweep for any isolated forbidden Unicode symbol still outside $...$
      if (FORBIDDEN_UNICODE_MATH_REGEX.test(p)) {
        const subParts = p.split(/(\$[^$\n]+\$)/g);
        p = subParts
          .map((sp) => {
            if (sp.startsWith("$") && sp.endsWith("$")) return sp;
            let fixed = sp;
            fixed = fixed.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸ]+/g, (m) => {
              const ascii = m.split("").map((c) => UNICODE_SUPER_TO_ASCII[c] || c).join("");
              return `$^{${ascii}}$`;
            });
            fixed = fixed.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]+/g, (m) => {
              const ascii = m.split("").map((c) => UNICODE_SUB_TO_ASCII[c] || c).join("");
              return `$_{${ascii}}$`;
            });
            for (const [uni, cmd] of Object.entries(UNICODE_TO_LATEX_MAP)) {
              if (uni !== "°" && fixed.includes(uni)) {
                fixed = fixed.split(uni).join(`$${cmd.trim()}$`);
              }
            }
            return fixed;
          })
          .join("");
      }
    }
    return p;
  };

  while ((match = mathTokenRegex.exec(s)) !== null) {
    if (match.index > lastIdx) {
      result += cleanPlainSlice(s.substring(lastIdx, match.index));
    }
    if (match[1] !== undefined) {
      result += `$$${enforceStrictRawLatexFormula(match[1])}$$`;
    } else if (match[2] !== undefined) {
      result += `$${enforceStrictRawLatexFormula(match[2])}$`;
    }
    lastIdx = mathTokenRegex.lastIndex;
  }

  if (lastIdx < s.length) {
    result += cleanPlainSlice(s.substring(lastIdx));
  }

  return result;
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
    FORBIDDEN_UNICODE_MATH_REGEX.test(text) ||
    /\b(?:\\alpha|\\beta|\\gamma|\\Delta|\\pi|\\theta|\\Omega|\\lambda|\\mu|\\sigma|\\pm|\\times|\\le|\\leq|\\ge|\\geq|\\approx|\\neq|\\in|\\subset|\\cup|\\cap)\b/.test(
      text
    )
  );
}
