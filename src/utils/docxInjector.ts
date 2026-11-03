import JSZip from 'jszip';
import {
  MathOutputFormat,
  autoWrapUnwrappedMathForEquation,
  cleanPlainProseForWord,
  convertLatexToOmmlDomElement,
  enforceStrictRawLatexFormula,
  ensureMathAndTagSpacing,
  normalizeContentForRawLatex,
  ommlElementToLatex,
} from './mathConverter';
import { splitMarkdownTableRow } from './docxExport';

/**
 * KIẾN TRÚC BẢO TOÀN NGUYÊN BẢN (AST Injection)
 * --------------------------------------------------------------
 * Giữ nguyên 100% file .docx gốc (bảng, bố cục, hình ảnh, công thức Equation/MathType,
 * Phiếu học tập, lề trang, header/footer...). Chỉ CHÈN THÊM các đoạn [[RED: ...]]
 * do AI sinh ra thành đoạn văn/bảng mới màu đỏ (#DC2626, không in đậm) ngay đúng vị trí.
 * Hỗ trợ đầy đủ cả 2 chế độ Toán học:
 *  - 'equation': Công thức mới tạo đối tượng <m:oMath> OMML chỉnh sửa được trong Word.
 *  - 'latex': Công thức hiển thị dạng mã LaTeX thô $...$ / $$...$$.
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const RED = 'DC2626';

export interface InjectionReport {
  total: number;
  injected: number;
  appended: number;
}

export interface InjectDocxOptions {
  mathFormat?: MathOutputFormat;
}

interface RedBlock {
  redText: string;
  anchorsWt: string[]; // normalized anchors without math
  anchorsFull: string[]; // normalized anchors including math tokens
  anchorTokens: string[][]; // word token lists for fuzzy matching
  anchorHint: string;
  isTrailingEnd: boolean; // true if placed at the very end after all original text (e.g. Rubric / Phụ lục)
}

/** Unified normalization used on BOTH sides (markdown & Word XML). */
function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Word-level tokenization for high-accuracy fuzzy anchor matching. */
function tokenizeWords(s: string): string[] {
  return s
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/** Remove markdown / app specific tokens including math (matches <w:t>-only view). */
function stripTokensNoMath(s: string): string {
  return s
    .replace(/\[\[IMAGE:[^\]]*\]\]/gi, ' ')
    .replace(/\[\[GEN_SVG:[^\]]*\]\]/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*#`]/g, '');
}

/** Remove markdown wrappers while keeping alphanumeric math content (matches <w:t>+<m:t> view). */
function stripTokensKeepMathText(s: string): string {
  return s
    .replace(/\[\[IMAGE:[^\]]*\]\]/gi, ' ')
    .replace(/\[\[GEN_SVG:[^\]]*\]\]/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[$*#`{}^_]/g, ' ');
}

/**
 * Extracts [[RED:...]] blocks from generated markdown, coalescing Markdown tables whose cells
 * are wrapped in [[RED:...]] (e.g. a newly added Rubric table) into a single coherent table block.
 */
function preprocessRedTablesInMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tblLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tblLines.push(lines[i].trim());
        i++;
      }
      const dataLines = tblLines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
      // Check if EVERY non-empty cell in this table is a newly added [[RED:...]] cell
      const allCells = dataLines.flatMap((l) => splitMarkdownTableRow(l).map((c) => c.trim()).filter(Boolean));
      const redCells = allCells.filter((c) => /\[\[\s*red\s*:/i.test(c));
      if (allCells.length >= 2 && redCells.length === allCells.length) {
        const cleanTbl = tblLines
          .map((l) => l.replace(/\[\[\s*red\s*:/gi, '').replace(/\]\]/g, ''))
          .join('\n');
        out.push(`[[RED:\n${cleanTbl}\n]]`);
      } else {
        out.push(...tblLines);
      }
      continue;
    }
    out.push(lines[i]);
    i++;
  }

  return out.join('\n');
}

function extractRedBlocks(markdown: string): RedBlock[] {
  const coalesced = preprocessRedTablesInMarkdown(markdown);
  const normalized = coalesced.replace(/\[\[\s*red\s*:/gi, '[[RED:');
  const totalNonRedClean = norm(
    stripTokensNoMath(normalized.replace(/\[\[RED:[\s\S]*?\]\]/g, ' '))
  );

  const regex = /\[\[RED:([\s\S]*?)\]\]/g;
  const blocks: RedBlock[] = [];
  let originalSoFar = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    originalSoFar += normalized.substring(lastIdx, match.index);
    lastIdx = regex.lastIndex;

    const redText = match[1].replace(/\[\[\s*RED:?/gi, '').replace(/\]\]/g, '').trim();
    if (!redText) continue;

    const remainingOriginal = normalized
      .slice(lastIdx)
      .replace(/\[\[RED:[\s\S]*?\]\]/g, ' ');
    const remainingNormLen = norm(stripTokensNoMath(remainingOriginal)).length;
    const isTrailingEnd = totalNonRedClean.length > 0 && remainingNormLen < 18;

    const segsNoMath = stripTokensNoMath(originalSoFar.slice(-5000))
      .split(/\n|\|/)
      .map((seg) => seg.replace(/^[\s#>*\-–+•]+/, '').trim())
      .filter((seg) => norm(seg).length >= 4 && !/^[-:\s]+$/.test(seg));

    const segsWithMath = stripTokensKeepMathText(originalSoFar.slice(-5000))
      .split(/\n|\|/)
      .map((seg) => seg.replace(/^[\s#>*\-–+•]+/, '').trim())
      .filter((seg) => norm(seg).length >= 4 && !/^[-:\s]+$/.test(seg));

    const recentNoMath = segsNoMath.slice(-6).reverse();
    const recentWithMath = segsWithMath.slice(-6).reverse();

    blocks.push({
      redText,
      anchorsWt: recentNoMath.map(norm).filter((a) => a.length >= 4),
      anchorsFull: recentWithMath.map(norm).filter((a) => a.length >= 4),
      anchorTokens: recentNoMath.map(tokenizeWords).filter((t) => t.length >= 2),
      anchorHint: recentNoMath[0] ? recentNoMath[0].slice(-80) : '',
      isTrailingEnd,
    });
  }
  return blocks;
}

/** Text of a paragraph from w:t only (equations excluded). */
function paragraphTextWtOnly(p: Element): string {
  const ts = p.getElementsByTagNameNS(W_NS, 't');
  let s = '';
  for (let i = 0; i < ts.length; i++) s += ts[i].textContent || '';
  return s;
}

/** Text of a paragraph including both w:t and OMML m:t. */
function paragraphTextFull(p: Element): string {
  let s = '';
  const walk = (node: Node) => {
    if (node.nodeType === 1) {
      const ln = (node as Element).localName;
      if (ln === 't') {
        s += node.textContent || '';
        return;
      }
      if (ln === 'tab' || ln === 'br') {
        s += ' ';
        return;
      }
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  };
  walk(p);
  return s;
}

function isInsideTextBox(el: Element): boolean {
  let cur: Node | null = el.parentNode;
  while (cur) {
    if ((cur as Element).localName === 'txbxContent') return true;
    cur = cur.parentNode;
  }
  return false;
}

type RedRenderItem =
  | { kind: 'line'; text: string }
  | { kind: 'table'; rows: string[][] };

/**
 * Parses a red payload into clean lines and structured tables (preserving math delimiters $...$/$$...$$,
 * removing raw Markdown '*', '**', '#', '<br>', etc.).
 */
function parseRedPayloadItems(redText: string, mathFormat: MathOutputFormat): RedRenderItem[] {
  let cleaned = redText
    .replace(/\[\[IMAGE:[^\]]*\]\]/gi, '')
    .replace(/\[\[GEN_SVG:[^\]]*\]\]/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|span|strong|b|em|i|u)[^>]*>/gi, '')
    .replace(/\[\.\.\.\]/g, '')
    .replace(/\[i\]/gi, '');

  if (mathFormat === 'latex') {
    cleaned = normalizeContentForRawLatex(cleaned);
  }

  const rawLines = cleaned.split(/\r?\n/);
  const items: RedRenderItem[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const trimmed = rawLines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // Markdown table inside [[RED:...]] (e.g. Rubric table)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows: string[][] = [];
      while (i < rawLines.length) {
        const tRow = rawLines[i].trim();
        if (!tRow.startsWith('|') || !tRow.endsWith('|')) break;
        if (!/^\|[\s\-:|]+\|$/.test(tRow)) {
          rows.push(splitMarkdownTableRow(tRow).map((c) => sanitizeRedLineText(c, mathFormat)));
        }
        i++;
      }
      if (rows.length > 0) {
        items.push({ kind: 'table', rows });
      }
      continue;
    }

    // Skip horizontal rules
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      i++;
      continue;
    }

    const lineClean = sanitizeRedLineText(trimmed, mathFormat);
    if (lineClean) {
      items.push({ kind: 'line', text: lineClean });
    }
    i++;
  }

  return items;
}

/**
 * Strips leading Markdown '#', '>', '* ' bullets, and bold/italic markers outside math
 * while keeping spaces and math expressions intact.
 */
function sanitizeRedLineText(line: string, mathFormat: MathOutputFormat): string {
  let s = line.trim();
  // Strip blockquote '>' and heading hashes '#..######'
  s = s.replace(/^(?:>\s*)+/, '').replace(/^#{1,6}(?:\s+|(?=[A-ZÀ-Ỹ0-9*]))/i, '');
  // Convert Markdown '* ' or '+ ' bullet to '- '
  s = s.replace(/^\s*[*+•]\s+/, '- ');
  s = ensureMathAndTagSpacing(s);

  // Strip Markdown '***', '**', '*', '`' OUTSIDE math delimiters ($...$, $$...$$, \(...\), \[...\])
  const mathSplit =
    mathFormat === 'latex'
      ? /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
      : /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+?\$|\\\([\s\S]+?\\\)|\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\})/g;

  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mathSplit.exec(s)) !== null) {
    if (m.index > last) {
      out += stripMarkdownStarsFromPlain(s.slice(last, m.index));
    }
    out += m[0];
    last = mathSplit.lastIndex;
  }
  if (last < s.length) {
    out += stripMarkdownStarsFromPlain(s.slice(last));
  }

  return ensureMathAndTagSpacing(out).trim();
}

function stripMarkdownStarsFromPlain(plain: string): string {
  return plain
    .replace(/\*{1,3}/g, '')
    .replace(/`/g, '')
    .replace(/(^|\s)#{1,6}\s+/g, '$1');
}

function createRedRun(xmlDoc: Document, anchorP: Element | null, text: string, bold = false): Element {
  const r = xmlDoc.createElementNS(W_NS, 'w:r');
  const rPr = xmlDoc.createElementNS(W_NS, 'w:rPr');

  const firstRun = anchorP ? anchorP.getElementsByTagNameNS(W_NS, 'r')[0] : undefined;
  const srcRPr = firstRun
    ? (Array.from(firstRun.childNodes).find((n) => (n as Element).localName === 'rPr') as
        | Element
        | undefined)
    : undefined;
  if (srcRPr) {
    ['rFonts', 'sz', 'szCs', 'lang'].forEach((name) => {
      const el = srcRPr.getElementsByTagNameNS(W_NS, name)[0];
      if (el) rPr.appendChild(el.cloneNode(true));
    });
  } else {
    const rFonts = xmlDoc.createElementNS(W_NS, 'w:rFonts');
    rFonts.setAttributeNS(W_NS, 'w:ascii', 'Times New Roman');
    rFonts.setAttributeNS(W_NS, 'w:hAnsi', 'Times New Roman');
    rFonts.setAttributeNS(W_NS, 'w:cs', 'Times New Roman');
    rPr.appendChild(rFonts);
    const sz = xmlDoc.createElementNS(W_NS, 'w:sz');
    sz.setAttributeNS(W_NS, 'w:val', '26');
    const szCs = xmlDoc.createElementNS(W_NS, 'w:szCs');
    szCs.setAttributeNS(W_NS, 'w:val', '26');
    rPr.appendChild(sz);
    rPr.appendChild(szCs);
  }

  if (bold) {
    const bEl = xmlDoc.createElementNS(W_NS, 'w:b');
    const szFirst = Array.from(rPr.childNodes).find((n) => (n as Element).localName === 'sz');
    if (szFirst) rPr.insertBefore(bEl, szFirst);
    else rPr.appendChild(bEl);
  }

  const color = xmlDoc.createElementNS(W_NS, 'w:color');
  color.setAttributeNS(W_NS, 'w:val', RED);
  const szEl = Array.from(rPr.childNodes).find((n) => (n as Element).localName === 'sz');
  if (szEl) rPr.insertBefore(color, szEl);
  else rPr.appendChild(color);

  r.appendChild(rPr);
  const t = xmlDoc.createElementNS(W_NS, 'w:t');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}

/**
 * Builds a red <w:p> paragraph supporting BOTH:
 * - 'equation' mode: real editable <m:oMath> OMML DOM objects + red plain prose runs
 * - 'latex' mode: verbatim $...$ / $$...$$ raw LaTeX in red plain runs (0 <m:oMath>)
 */
function buildRedParagraph(
  xmlDoc: Document,
  anchorP: Element | null,
  text: string,
  mathFormat: MathOutputFormat = 'equation',
  forceBold = false
): Element {
  const p = xmlDoc.createElementNS(W_NS, 'w:p');

  // Clone safe paragraph properties from anchor paragraph
  const srcPPr = anchorP
    ? (Array.from(anchorP.childNodes).find((n) => (n as Element).localName === 'pPr') as
        | Element
        | undefined)
    : undefined;
  let pPr: Element | null = null;
  if (srcPPr) {
    pPr = srcPPr.cloneNode(true) as Element;
    Array.from(pPr.childNodes).forEach((c) => {
      const ln = (c as Element).localName;
      if (ln === 'sectPr' || ln === 'numPr' || ln === 'pPrChange') pPr!.removeChild(c);
      if (ln === 'pStyle') {
        const v =
          (c as Element).getAttributeNS(W_NS, 'val') || (c as Element).getAttribute('w:val') || '';
        if (/heading|title|tieude|^\d$/i.test(v)) pPr!.removeChild(c);
      }
    });
    p.appendChild(pPr);
  }

  if (mathFormat === 'latex') {
    const rawTrimmed = text.trim();
    if (/^\$\$[\s\S]+\$\$$/.test(rawTrimmed)) {
      if (!pPr) {
        pPr = xmlDoc.createElementNS(W_NS, 'w:pPr');
        p.appendChild(pPr);
      }
      const existingJc = pPr.getElementsByTagNameNS(W_NS, 'jc')[0];
      if (existingJc) pPr.removeChild(existingJc);
      const jc = xmlDoc.createElementNS(W_NS, 'w:jc');
      jc.setAttributeNS(W_NS, 'w:val', 'center');
      pPr.appendChild(jc);
    }
    p.appendChild(createRedRun(xmlDoc, anchorP, text, forceBold));
    return p;
  }

  // 'equation' mode: auto-wrap any unwrapped math expressions, then emit <w:r> + <m:oMath>
  const mathRegex =
    /(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|(\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}))/g;

  let prepared = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = mathRegex.exec(text)) !== null) {
    if (m.index > last) {
      prepared += autoWrapUnwrappedMathForEquation(text.slice(last, m.index));
    }
    prepared += m[0];
    last = mathRegex.lastIndex;
  }
  if (last < text.length) {
    prepared += autoWrapUnwrappedMathForEquation(text.slice(last));
  }
  prepared = ensureMathAndTagSpacing(prepared);

  // Standalone display equation paragraph -> wrap in <m:oMathPara><m:oMath>
  const standaloneDisplay = prepared.trim().match(/^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])$/);
  if (standaloneDisplay && !prepared.trim().slice(2, -2).includes('$$')) {
    const formula = (standaloneDisplay[1] || standaloneDisplay[2] || '').trim();
    if (formula) {
      const oMathPara = xmlDoc.createElementNS(M_NS, 'm:oMathPara');
      oMathPara.appendChild(convertLatexToOmmlDomElement(xmlDoc, formula, true));
      p.appendChild(oMathPara);
      return p;
    }
  }

  mathRegex.lastIndex = 0;
  let ptr = 0;
  let tm: RegExpExecArray | null;
  let appendedCount = 0;

  while ((tm = mathRegex.exec(prepared)) !== null) {
    if (tm.index > ptr) {
      const plain = cleanPlainProseForWord(prepared.slice(ptr, tm.index));
      if (plain) {
        p.appendChild(createRedRun(xmlDoc, anchorP, plain, forceBold));
        appendedCount++;
      }
    }
    const formula = (tm[1] || tm[2] || tm[3] || tm[4] || tm[5] || '').trim();
    if (formula) {
      p.appendChild(convertLatexToOmmlDomElement(xmlDoc, formula, true));
      appendedCount++;
    }
    ptr = mathRegex.lastIndex;
  }

  if (ptr < prepared.length) {
    const rem = cleanPlainProseForWord(prepared.slice(ptr));
    if (rem) {
      p.appendChild(createRedRun(xmlDoc, anchorP, rem, forceBold));
      appendedCount++;
    }
  }

  if (appendedCount === 0) {
    p.appendChild(createRedRun(xmlDoc, anchorP, cleanPlainProseForWord(text), forceBold));
  }

  return p;
}

/**
 * Builds a clean bordered OpenXML <w:tbl> for red Markdown tables (e.g. Rubric đánh giá năng lực số).
 */
function buildRedTable(
  xmlDoc: Document,
  anchorP: Element | null,
  rows: string[][],
  mathFormat: MathOutputFormat
): Element {
  const tbl = xmlDoc.createElementNS(W_NS, 'w:tbl');
  const tblPr = xmlDoc.createElementNS(W_NS, 'w:tblPr');

  const tblW = xmlDoc.createElementNS(W_NS, 'w:tblW');
  tblW.setAttributeNS(W_NS, 'w:w', '5000');
  tblW.setAttributeNS(W_NS, 'w:type', 'pct');
  tblPr.appendChild(tblW);

  const tblBorders = xmlDoc.createElementNS(W_NS, 'w:tblBorders');
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach((side) => {
    const b = xmlDoc.createElementNS(W_NS, `w:${side}`);
    b.setAttributeNS(W_NS, 'w:val', 'single');
    b.setAttributeNS(W_NS, 'w:sz', '4');
    b.setAttributeNS(W_NS, 'w:space', '0');
    b.setAttributeNS(W_NS, 'w:color', RED);
    tblBorders.appendChild(b);
  });
  tblPr.appendChild(tblBorders);
  tbl.appendChild(tblPr);

  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const colPct = Math.floor(5000 / colCount);

  rows.forEach((rowCells) => {
    const tr = xmlDoc.createElementNS(W_NS, 'w:tr');
    for (let c = 0; c < colCount; c++) {
      const tc = xmlDoc.createElementNS(W_NS, 'w:tc');
      const tcPr = xmlDoc.createElementNS(W_NS, 'w:tcPr');
      const tcW = xmlDoc.createElementNS(W_NS, 'w:tcW');
      tcW.setAttributeNS(W_NS, 'w:w', String(colPct));
      tcW.setAttributeNS(W_NS, 'w:type', 'pct');
      tcPr.appendChild(tcW);
      tc.appendChild(tcPr);

      const cellStr = (rowCells[c] || '').trim();
      const cellLines = cellStr
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (cellLines.length === 0) {
        tc.appendChild(buildRedParagraph(xmlDoc, anchorP, '', mathFormat, false));
      } else {
        cellLines.forEach((cl) => {
          tc.appendChild(buildRedParagraph(xmlDoc, anchorP, cl, mathFormat, false));
        });
      }
      tr.appendChild(tc);
    }
    tbl.appendChild(tr);
  });

  return tbl;
}

/**
 * When mathFormat === 'latex', converts any existing <m:oMath> / <m:oMathPara> in the original
 * Word XML into verbatim raw LaTeX $...$ / $$...$$ runs so the output strictly satisfies
 * 0 OMML objects and 100% raw LaTeX while preserving 100% of the original .docx layout & tables.
 */
function convertExistingOmmlToRawLatexInDom(xmlDoc: Document): void {
  const oMathParas = Array.from(xmlDoc.getElementsByTagNameNS(M_NS, 'oMathPara'));
  for (const omp of oMathParas) {
    const parentP = omp.parentNode as Element | null;
    if (!parentP) continue;
    const latex = enforceStrictRawLatexFormula(ommlElementToLatex(omp));
    const run = createPlainSiblingRun(xmlDoc, parentP, latex ? `$$${latex}$$` : '');
    parentP.replaceChild(run, omp);
  }

  const oMaths = Array.from(xmlDoc.getElementsByTagNameNS(M_NS, 'oMath'));
  for (const om of oMaths) {
    const parent = om.parentNode as Element | null;
    if (!parent) continue;
    const latex = enforceStrictRawLatexFormula(ommlElementToLatex(om));
    const run = createPlainSiblingRun(xmlDoc, parent, latex ? `$${latex}$` : '');
    parent.replaceChild(run, om);
  }
}

function createPlainSiblingRun(xmlDoc: Document, parentP: Element, text: string): Element {
  const r = xmlDoc.createElementNS(W_NS, 'w:r');
  const firstRun = parentP.getElementsByTagNameNS(W_NS, 'r')[0];
  const srcRPr = firstRun
    ? (Array.from(firstRun.childNodes).find((n) => (n as Element).localName === 'rPr') as
        | Element
        | undefined)
    : undefined;
  if (srcRPr) {
    r.appendChild(srcRPr.cloneNode(true));
  }
  const t = xmlDoc.createElementNS(W_NS, 'w:t');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  return r;
}

function insertAfter(ref: Node, node: Node) {
  const parent = ref.parentNode;
  if (!parent) return;
  if (ref.nextSibling) parent.insertBefore(node, ref.nextSibling);
  else parent.appendChild(node);
}

export async function injectIntoDocxWithReport(
  originalDocxBuffer: ArrayBuffer,
  markdownContent: string,
  options?: InjectDocxOptions
): Promise<{ blob: Blob; report: InjectionReport }> {
  const mathFormat: MathOutputFormat = options?.mathFormat === 'latex' ? 'latex' : 'equation';
  const zip = await JSZip.loadAsync(originalDocxBuffer);
  const docXmlStr = await zip.file('word/document.xml')?.async('string');
  if (!docXmlStr) throw new Error('Không thể đọc tệp document.xml từ file Word gốc.');

  const xmlDoc = new DOMParser().parseFromString(docXmlStr, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('File Word gốc có cấu trúc XML không hợp lệ.');
  }

  const docRoot = xmlDoc.documentElement;
  if (docRoot && mathFormat === 'equation' && !docRoot.getAttribute('xmlns:m')) {
    docRoot.setAttribute('xmlns:m', M_NS);
  }

  const body = xmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  const allP = Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'p')).filter(
    (p) => !isInsideTextBox(p)
  );
  const pNormWt = allP.map((p) => norm(paragraphTextWtOnly(p)));
  const pNormFull = allP.map((p) => norm(paragraphTextFull(p)));
  const pTokenSets = allP.map((p) => new Set(tokenizeWords(paragraphTextFull(p))));

  const blocks = extractRedBlocks(markdownContent);
  const lastInserted = new Map<number, Element>();
  const unmatched: RedBlock[] = [];
  let cursor = 0;

  const findExactOrSlice = (anchor: string, pArr: string[]): number => {
    const keys: string[] = [];
    if (anchor.length <= 220) keys.push(anchor);
    [70, 40, 20, 12].forEach((n) => {
      if (anchor.length > n) keys.push(anchor.slice(-n));
    });
    for (const key of keys) {
      if (key.length < 4) continue;
      for (let pass = 0; pass < 2; pass++) {
        const start = pass === 0 ? cursor : 0;
        const end = pass === 0 ? allP.length : cursor;
        for (let i = start; i < end; i++) {
          if (pArr[i] && pArr[i].includes(key)) return i;
        }
      }
    }
    for (let i = cursor; i < allP.length; i++) {
      if (pArr[i].length >= 10 && anchor.endsWith(pArr[i])) return i;
    }
    return -1;
  };

  const findFuzzyByTokens = (tokens: string[]): number => {
    if (tokens.length < 3) return -1;
    const queryTokens = tokens.slice(-14);
    let bestIdx = -1;
    let bestScore = 0;

    for (let pass = 0; pass < 2; pass++) {
      const start = pass === 0 ? cursor : 0;
      const end = pass === 0 ? allP.length : cursor;
      for (let i = start; i < end; i++) {
        const pSet = pTokenSets[i];
        if (pSet.size < 2) continue;
        let hit = 0;
        for (const t of queryTokens) {
          if (pSet.has(t)) hit++;
        }
        const coverage = hit / queryTokens.length;
        // Prefer matches forward from cursor slightly
        const orderBonus = pass === 0 ? 0.04 : 0;
        const score = coverage + orderBonus;
        if (coverage >= 0.68 && score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) return bestIdx;
    }
    return bestIdx;
  };

  let injected = 0;
  for (const block of blocks) {
    const items = parseRedPayloadItems(block.redText, mathFormat);
    if (items.length === 0) continue;

    let idx = -1;
    for (const anchor of block.anchorsWt) {
      idx = findExactOrSlice(anchor, pNormWt);
      if (idx >= 0) break;
    }
    if (idx < 0) {
      for (const anchor of block.anchorsFull) {
        idx = findExactOrSlice(anchor, pNormFull);
        if (idx >= 0) break;
      }
    }
    if (idx < 0) {
      for (const tokList of block.anchorTokens) {
        idx = findFuzzyByTokens(tokList);
        if (idx >= 0) break;
      }
    }

    // If this block is an intentional trailing appendix / rubric placed after all original content,
    // append it cleanly at the end of the document body (right before <w:sectPr>) and count as injected!
    if (idx < 0 && block.isTrailingEnd && body) {
      const finalSectPr =
        Array.from(body.childNodes).find((n) => (n as Element).localName === 'sectPr') || null;
      const refAnchorP = allP.length > 0 ? allP[allP.length - 1] : null;
      for (const item of items) {
        if (item.kind === 'table') {
          body.insertBefore(buildRedTable(xmlDoc, refAnchorP, item.rows, mathFormat), finalSectPr);
        } else {
          body.insertBefore(
            buildRedParagraph(xmlDoc, refAnchorP, item.text, mathFormat, false),
            finalSectPr
          );
        }
      }
      injected++;
      continue;
    }

    if (idx < 0) {
      unmatched.push(block);
      continue;
    }

    const anchorP = allP[idx];
    let ref: Element = lastInserted.get(idx) || anchorP;
    const parentLocal = (ref.parentNode as Element | null)?.localName || '';
    const canInsertTable = parentLocal === 'body' || parentLocal === 'tc';

    for (const item of items) {
      if (item.kind === 'table' && canInsertTable) {
        const tblEl = buildRedTable(xmlDoc, anchorP, item.rows, mathFormat);
        insertAfter(ref, tblEl);
        ref = tblEl;
      } else if (item.kind === 'table') {
        for (const r of item.rows) {
          const newP = buildRedParagraph(xmlDoc, anchorP, r.join(' — '), mathFormat, false);
          insertAfter(ref, newP);
          ref = newP;
        }
      } else {
        const newP = buildRedParagraph(xmlDoc, anchorP, item.text, mathFormat, false);
        insertAfter(ref, newP);
        ref = newP;
      }
    }
    lastInserted.set(idx, ref);
    cursor = idx;
    injected++;
  }

  // Fallback appendix for any block whose anchor was genuinely missing
  if (unmatched.length > 0 && body) {
    const finalSectPr =
      Array.from(body.childNodes).find((n) => (n as Element).localName === 'sectPr') || null;
    const refAnchorP = allP.length > 0 ? allP[allP.length - 1] : null;
    const addLine = (text: string, bold = false) => {
      const p = buildRedParagraph(xmlDoc, refAnchorP, text, mathFormat, bold);
      body.insertBefore(p, finalSectPr);
    };
    addLine('PHỤ LỤC BỔ SUNG: NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ', false);
    unmatched.forEach((b) => {
      const items = parseRedPayloadItems(b.redText, mathFormat);
      for (const item of items) {
        if (item.kind === 'table') {
          body.insertBefore(buildRedTable(xmlDoc, refAnchorP, item.rows, mathFormat), finalSectPr);
        } else {
          addLine(item.text, false);
        }
      }
    });
  }

  if (mathFormat === 'latex') {
    convertExistingOmmlToRawLatexInDom(xmlDoc);
  }

  let newXmlStr = new XMLSerializer().serializeToString(xmlDoc);
  if (!newXmlStr.startsWith('<?xml')) {
    newXmlStr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + newXmlStr;
  }
  zip.file('word/document.xml', newXmlStr);

  const outArrayBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  });
  const blob = new Blob([outArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return {
    blob,
    report: { total: blocks.length, injected, appended: unmatched.length },
  };
}

export async function injectIntoDocx(
  originalDocxBuffer: ArrayBuffer,
  markdownContent: string,
  options?: InjectDocxOptions
): Promise<Blob> {
  const { blob } = await injectIntoDocxWithReport(originalDocxBuffer, markdownContent, options);
  return blob;
}
