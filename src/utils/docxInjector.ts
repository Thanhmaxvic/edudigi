import JSZip from 'jszip';
import { latexToUnicode } from './mathConverter';

/**
 * KIẾN TRÚC BẢO TOÀN NGUYÊN BẢN (AST Injection)
 * --------------------------------------------------------------
 * Giữ nguyên 100% file .docx gốc (bảng, công thức MathType/Equation, hình ảnh,
 * lề trang, section...). Chỉ CHÈN THÊM các đoạn [[RED: ...]] do AI sinh ra
 * thành đoạn văn mới màu đỏ ngay sau đoạn văn gốc tương ứng.
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const RED = 'DC2626';

export interface InjectionReport {
  total: number;
  injected: number;
  appended: number;
}

interface RedBlock {
  redText: string;
  anchors: string[]; // normalized anchor candidates, most specific (closest) first
  anchorHint: string; // human readable anchor for appendix
}

/** Unified normalization used on BOTH sides (markdown & Word XML). */
function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Remove markdown / app specific tokens that never exist in the original Word text. */
function stripTokens(s: string): string {
  return s
    .replace(/\[\[IMAGE:[^\]]*\]\]/gi, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '');
}

function extractRedBlocks(markdown: string): RedBlock[] {
  const normalized = markdown.replace(/\[\[\s*red\s*:/gi, '[[RED:');
  const regex = /\[\[RED:([\s\S]*?)\]\]/g;
  const blocks: RedBlock[] = [];
  let originalSoFar = ''; // markdown text before current block, with previous red blocks removed
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    originalSoFar += normalized.substring(lastIdx, match.index);
    lastIdx = regex.lastIndex;

    const redText = match[1].replace(/\[\[\s*RED:?/gi, '').replace(/\]\]/g, '').trim();
    if (!redText) continue;

    // Split preceding original text into segments (lines, table cells, <br>)
    const segments = stripTokens(originalSoFar.slice(-4000))
      .split(/\n|\|/)
      .map((seg) => seg.replace(/^[\s#>*\-–+]+/, '').trim())
      .filter((seg) => norm(seg).length >= 6 && !/^[-:\s]+$/.test(seg));

    const anchorSegs = segments.slice(-4).reverse();
    blocks.push({
      redText,
      anchors: anchorSegs.map(norm),
      anchorHint: anchorSegs[0] ? anchorSegs[0].slice(-80) : '',
    });
  }
  return blocks;
}

/** Text of a paragraph from w:t only (OMML m:t & MathType objects are ignored on both sides). */
function paragraphText(p: Element): string {
  const ts = p.getElementsByTagNameNS(W_NS, 't');
  let s = '';
  for (let i = 0; i < ts.length; i++) s += ts[i].textContent || '';
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

/** Turn a red markdown payload into clean plain lines for Word. */
function redTextToLines(redText: string): string[] {
  const withMath = redText
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => latexToUnicode(f))
    .replace(/\$([^$\n]+?)\$/g, (_, f) => latexToUnicode(f))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => latexToUnicode(f))
    .replace(/\[\[IMAGE:[^\]]*\]\]/gi, '')
    .replace(/\*\*/g, '')
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return withMath
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[*+]\s+/, '- ').trim())
    .filter((l) => l.length > 0 && !/^\|?[\s\-:|]+\|?$/.test(l));
}

function buildRedParagraph(xmlDoc: Document, anchorP: Element | null, text: string): Element {
  const p = xmlDoc.createElementNS(W_NS, 'w:p');

  // Clone paragraph properties (indent, alignment, spacing inside table cells),
  // but NEVER clone section breaks or list numbering (would break layout).
  const srcPPr = anchorP ? Array.from(anchorP.childNodes).find((n) => (n as Element).localName === 'pPr') as Element | undefined : undefined;
  if (srcPPr) {
    const pPr = srcPPr.cloneNode(true) as Element;
    Array.from(pPr.childNodes).forEach((c) => {
      const ln = (c as Element).localName;
      if (ln === 'sectPr' || ln === 'numPr' || ln === 'pPrChange') pPr.removeChild(c);
      if (ln === 'pStyle') {
        const v = (c as Element).getAttributeNS(W_NS, 'val') || (c as Element).getAttribute('w:val') || '';
        if (/heading|title|tieude|^\d$/i.test(v)) pPr.removeChild(c);
      }
    });
    p.appendChild(pPr);
  }

  const r = xmlDoc.createElementNS(W_NS, 'w:r');
  const rPr = xmlDoc.createElementNS(W_NS, 'w:rPr');

  // Reuse the original font family & size so the new line blends with the document.
  const firstRun = anchorP ? anchorP.getElementsByTagNameNS(W_NS, 'r')[0] : undefined;
  const srcRPr = firstRun ? Array.from(firstRun.childNodes).find((n) => (n as Element).localName === 'rPr') as Element | undefined : undefined;
  if (srcRPr) {
    ['rFonts', 'sz', 'szCs', 'lang'].forEach((name) => {
      const el = srcRPr.getElementsByTagNameNS(W_NS, name)[0];
      if (el) rPr.appendChild(el.cloneNode(true));
    });
  }
  const color = xmlDoc.createElementNS(W_NS, 'w:color');
  color.setAttributeNS(W_NS, 'w:val', RED);
  // w:color must come after rFonts and before sz in the schema order
  const szEl = Array.from(rPr.childNodes).find((n) => (n as Element).localName === 'sz');
  if (szEl) rPr.insertBefore(color, szEl);
  else rPr.appendChild(color);

  r.appendChild(rPr);
  const t = xmlDoc.createElementNS(W_NS, 'w:t');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);
  return p;
}

function insertAfter(ref: Node, node: Node) {
  const parent = ref.parentNode;
  if (!parent) return;
  if (ref.nextSibling) parent.insertBefore(node, ref.nextSibling);
  else parent.appendChild(node);
}

export async function injectIntoDocxWithReport(
  originalDocxBuffer: ArrayBuffer,
  markdownContent: string
): Promise<{ blob: Blob; report: InjectionReport }> {
  const zip = await JSZip.loadAsync(originalDocxBuffer);
  const docXmlStr = await zip.file('word/document.xml')?.async('string');
  if (!docXmlStr) throw new Error('Không thể đọc tệp document.xml từ file Word gốc.');

  const xmlDoc = new DOMParser().parseFromString(docXmlStr, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('File Word gốc có cấu trúc XML không hợp lệ.');
  }

  const body = xmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  const allP = Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'p')).filter((p) => !isInsideTextBox(p));
  const pNorm = allP.map((p) => norm(paragraphText(p)));

  const blocks = extractRedBlocks(markdownContent);
  const lastInserted = new Map<number, Element>();
  const unmatched: RedBlock[] = [];
  let cursor = 0;

  const findParagraph = (anchor: string): number => {
    const keys: string[] = [];
    if (anchor.length <= 200) keys.push(anchor);
    [60, 30, 15].forEach((n) => {
      if (anchor.length > n) keys.push(anchor.slice(-n));
    });
    for (const key of keys) {
      // search forward from cursor (keeps document order), then wrap around
      for (let pass = 0; pass < 2; pass++) {
        const start = pass === 0 ? cursor : 0;
        const end = pass === 0 ? allP.length : cursor;
        for (let i = start; i < end; i++) {
          if (pNorm[i] && pNorm[i].includes(key)) return i;
        }
      }
    }
    // Paragraph shorter than anchor (anchor merged several lines)
    for (let i = cursor; i < allP.length; i++) {
      if (pNorm[i].length >= 12 && anchor.endsWith(pNorm[i])) return i;
    }
    return -1;
  };

  let injected = 0;
  for (const block of blocks) {
    let idx = -1;
    for (const anchor of block.anchors) {
      idx = findParagraph(anchor);
      if (idx >= 0) break;
    }
    const lines = redTextToLines(block.redText);
    if (lines.length === 0) continue;

    if (idx < 0) {
      unmatched.push(block);
      continue;
    }

    const anchorP = allP[idx];
    let ref: Element = lastInserted.get(idx) || anchorP;
    for (const line of lines) {
      const newP = buildRedParagraph(xmlDoc, anchorP, line);
      insertAfter(ref, newP);
      ref = newP;
    }
    lastInserted.set(idx, ref);
    cursor = idx;
    injected++;
  }

  // Never lose content: blocks without a reliable anchor go to an appendix at the end.
  if (unmatched.length > 0 && body) {
    const finalSectPr = Array.from(body.childNodes).find((n) => (n as Element).localName === 'sectPr') || null;
    const add = (text: string, bold = false) => {
      const p = buildRedParagraph(xmlDoc, null, text);
      if (bold) {
        const rPr = p.getElementsByTagNameNS(W_NS, 'rPr')[0];
        rPr.insertBefore(xmlDoc.createElementNS(W_NS, 'w:b'), rPr.firstChild);
      }
      body.insertBefore(p, finalSectPr);
    };
    add('PHỤ LỤC: NỘI DUNG TÍCH HỢP NĂNG LỰC SỐ CHƯA XÁC ĐỊNH ĐƯỢC VỊ TRÍ CHÈN TỰ ĐỘNG', true);
    add('(Thầy/Cô vui lòng cắt – dán các đoạn dưới đây vào đúng vị trí trong giáo án)');
    unmatched.forEach((b, i) => {
      add(`${i + 1}. ${b.anchorHint ? `[Sau đoạn: "…${b.anchorHint}"]` : ''}`, true);
      redTextToLines(b.redText).forEach((l) => add(l));
    });
  }

  let newXmlStr = new XMLSerializer().serializeToString(xmlDoc);
  if (!newXmlStr.startsWith('<?xml')) {
    newXmlStr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + newXmlStr;
  }
  zip.file('word/document.xml', newXmlStr);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });

  return {
    blob,
    report: { total: blocks.length, injected, appended: unmatched.length },
  };
}

export async function injectIntoDocx(originalDocxBuffer: ArrayBuffer, markdownContent: string): Promise<Blob> {
  const { blob } = await injectIntoDocxWithReport(originalDocxBuffer, markdownContent);
  return blob;
}
