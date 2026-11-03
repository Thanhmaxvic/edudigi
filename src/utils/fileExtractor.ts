import JSZip from 'jszip';
import mammoth from 'mammoth';
import { ommlElementToLatex } from './mathConverter';

export interface ExtractedPlanImage {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 string without data prefix
  previewUrl: string; // Complete data URI for <img> src
  width?: number;
  height?: number;
}

export interface DocxTemplateProfile {
  pageWidthDxa?: number;
  pageHeightDxa?: number;
  margins?: { top: number; bottom: number; left: number; right: number };
  fontName?: string;
  fontSize?: number; // half-points, e.g. 26 = 13pt, 28 = 14pt
  lineSpacing?: number; // e.g. 240 = 1.0, 276 = 1.15, 360 = 1.5
  paraSpacing?: number; // dxa after paragraph
  hasSchoolHeader?: boolean;
  /** Column width ratios (summing to 1) keyed by column count (2, 3, 4...) */
  tableColRatiosByColCount?: Record<number, number[]>;
  tableBorderColor?: string;
  tableBorderSize?: number;
}

export interface ExtractedPlanResult {
  text: string;
  images: ExtractedPlanImage[];
  templateProfile?: DocxTemplateProfile;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * Reads natural pixel dimensions (width, height) directly from PNG or JPEG binary bytes.
 * Works identically in Web Browsers and Node.js with zero external dependencies.
 */
export function getImageDimensionsFromBytes(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (!bytes || bytes.length < 24) return null;

  // 1. PNG signature: 89 50 4E 47 0D 0A 1A 0A, followed by IHDR chunk at offset 16..23
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width > 0 && height > 0 && width < 20000 && height < 20000) {
      return { width, height };
    }
  }

  // 2. GIF signature: GIF87a / GIF89a (little-endian uint16 at offset 6..9)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    if (width > 0 && height > 0) return { width, height };
  }

  // 3. JPEG signature: FF D8 ... scan for SOF0..SOF3 / SOF5..SOF7 / SOF9..SOF11 / SOF13..SOF15
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset++;
        continue;
      }
      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        offset += 2;
        continue;
      }
      if (offset + 4 >= bytes.length) break;
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segLen < 2) break;

      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isSof && offset + 8 < bytes.length) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        if (width > 0 && height > 0 && width < 20000 && height < 20000) {
          return { width, height };
        }
      }
      offset += 2 + segLen;
    }
  }

  return null;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function getLocalName(node: Node): string {
  const el = node as Element;
  return el.localName || (el.nodeName ? el.nodeName.replace(/^.*:/, '') : '');
}

function getWAttr(el: Element | null, name: string): string {
  if (!el) return '';
  return (
    el.getAttributeNS(W_NS, name) ||
    el.getAttribute(`w:${name}`) ||
    el.getAttribute(name) ||
    ''
  );
}

function getRAttr(el: Element | null, name: string): string {
  if (!el) return '';
  return (
    el.getAttributeNS(R_NS, name) ||
    el.getAttribute(`r:${name}`) ||
    el.getAttribute(name) ||
    ''
  );
}

function findDirectChild(parent: Element | null, localName: string): Element | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i];
    if (c.nodeType === 1 && getLocalName(c) === localName) {
      return c as Element;
    }
  }
  return null;
}

function findDirectChildren(parent: Element | null, localName: string): Element[] {
  const out: Element[] = [];
  if (!parent) return out;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes[i];
    if (c.nodeType === 1 && getLocalName(c) === localName) {
      out.push(c as Element);
    }
  }
  return out;
}

function isToggleEnabled(rPr: Element | null, propName: string): boolean {
  const prop = findDirectChild(rPr, propName);
  if (!prop) return false;
  const val = getWAttr(prop, 'val').toLowerCase();
  return val !== '0' && val !== 'false' && val !== 'none' && val !== 'off';
}

function inferImageMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.wmf')) return 'image/x-wmf';
  if (lower.endsWith('.emf')) return 'image/x-emf';
  return 'image/png';
}

/**
 * Formats styled inline runs into clean Markdown without EVER gluing words or leaving
 * leading/trailing spaces trapped inside **...** or *...* markers.
 */
interface StyledRunPiece {
  kind: 'text' | 'math' | 'display_math' | 'image' | 'br';
  text: string;
  bold?: boolean;
  italic?: boolean;
}

function serializeStyledPieces(pieces: StyledRunPiece[], lineBreakToken: string): string {
  // Merge consecutive text pieces with identical bold/italic flags
  const merged: StyledRunPiece[] = [];
  for (const p of pieces) {
    if (!p.text && p.kind === 'text') continue;
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;
    if (
      p.kind === 'text' &&
      prev &&
      prev.kind === 'text' &&
      !!prev.bold === !!p.bold &&
      !!prev.italic === !!p.italic
    ) {
      prev.text += p.text;
    } else {
      merged.push({ ...p });
    }
  }

  let out = '';
  for (const seg of merged) {
    if (seg.kind === 'br') {
      out += lineBreakToken;
      continue;
    }
    if (seg.kind === 'image') {
      const needLead = out.length > 0 && !/[\s\n>]$/.test(out);
      out += `${needLead ? ' ' : ''}${seg.text} `;
      continue;
    }
    if (seg.kind === 'display_math') {
      const cleanLatex = seg.text.trim();
      if (cleanLatex) {
        out += `${out && !out.endsWith('\n') && !out.endsWith(lineBreakToken) ? lineBreakToken : ''}$$${cleanLatex}$$${lineBreakToken}`;
      }
      continue;
    }
    if (seg.kind === 'math') {
      const cleanLatex = seg.text.trim();
      if (cleanLatex) {
        const needLead = out.length > 0 && /[\p{L}\p{N}]$/u.test(out);
        out += `${needLead ? ' ' : ''}$${cleanLatex}$`;
      }
      continue;
    }

    // Plain/bold/italic text: move outer whitespace outside ** / * markers!
    let txt = seg.text;
    if (out.endsWith('$') && /^[\p{L}]/u.test(txt)) {
      out += ' ';
    }
    if (!seg.bold && !seg.italic) {
      out += txt;
      continue;
    }
    const leadWs = txt.match(/^[ \t]+/)?.[0] || '';
    const trailWs = txt.match(/[ \t]+$/)?.[0] || '';
    const core = txt.trim();
    if (!core) {
      out += txt;
      continue;
    }
    // Strip any accidental internal '**' so Markdown markers stay balanced
    const safeCore = core.replace(/\*{2,}/g, '');
    if (!safeCore) {
      out += txt;
      continue;
    }
    if (seg.bold && seg.italic) {
      out += `${leadWs}***${safeCore}***${trailWs}`;
    } else if (seg.bold) {
      out += `${leadWs}**${safeCore}**${trailWs}`;
    } else {
      out += `${leadWs}*${safeCore}*${trailWs}`;
    }
  }

  return out;
}

/**
 * Direct OpenXML (.docx) parser using JSZip + DOMParser.
 * Preserves 100% of:
 * - OMML Word Equations (<m:oMath>, <m:oMathPara>) converted accurately to LaTeX $...$
 * - Tab spacing (<w:tab/>) in worksheets / multiple-choice options (preventing "dính chữ"!)
 * - Paragraph & intra-cell line breaks (<w:p>, <w:br/>)
 * - Bold / Italic styling
 * - Multi-column tables, column width ratios, and 1-column bordered Phiếu Học Tập boxes
 * - Embedded images at exact positions with exact pixel dimensions / aspect ratios
 * - Document page margins, font family, font size, and line spacing (DocxTemplateProfile)
 */
export async function extractDocxDirectFromXml(arrayBuffer: ArrayBuffer): Promise<ExtractedPlanResult> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlStr = await zip.file('word/document.xml')?.async('string');
  if (!docXmlStr || typeof DOMParser === 'undefined') {
    throw new Error('DOMParser or word/document.xml unavailable');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXmlStr, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid XML in word/document.xml');
  }

  // 1. Parse relationships (word/_rels/document.xml.rels) for embedded media
  const relMap = new Map<string, string>();
  const relsStr = await zip.file('word/_rels/document.xml.rels')?.async('string');
  if (relsStr) {
    const relsDoc = parser.parseFromString(relsStr, 'application/xml');
    const rels = Array.from(relsDoc.getElementsByTagName('Relationship'));
    for (const rel of rels) {
      const id = rel.getAttribute('Id') || '';
      const target = rel.getAttribute('Target') || '';
      if (id && target) {
        const cleanTarget = target.startsWith('/')
          ? target.slice(1)
          : target.startsWith('word/')
          ? target
          : `word/${target.replace(/^\.\//, '')}`;
        relMap.set(id, cleanTarget);
      }
    }
  }

  // 2. Parse optional styles.xml for default font & size
  const templateProfile: DocxTemplateProfile = {
    tableColRatiosByColCount: {},
  };
  const stylesStr = await zip.file('word/styles.xml')?.async('string');
  if (stylesStr) {
    const stylesDoc = parser.parseFromString(stylesStr, 'application/xml');
    const rPrDef = stylesDoc.getElementsByTagNameNS(W_NS, 'rPrDefault')[0];
    if (rPrDef) {
      const rFonts = rPrDef.getElementsByTagNameNS(W_NS, 'rFonts')[0];
      const asciiFont = getWAttr(rFonts || null, 'ascii') || getWAttr(rFonts || null, 'hAnsi');
      if (asciiFont && !asciiFont.startsWith('+')) {
        templateProfile.fontName = asciiFont;
      }
      const szEl = rPrDef.getElementsByTagNameNS(W_NS, 'sz')[0];
      const szVal = parseInt(getWAttr(szEl || null, 'val'), 10);
      if (!isNaN(szVal) && szVal >= 18 && szVal <= 40) {
        templateProfile.fontSize = szVal;
      }
    }
  }

  // 3. Extract section page setup (<w:sectPr>)
  const sectPrs = Array.from(xmlDoc.getElementsByTagNameNS(W_NS, 'sectPr'));
  const mainSectPr = sectPrs[sectPrs.length - 1];
  if (mainSectPr) {
    const pgSz = findDirectChild(mainSectPr, 'pgSz');
    if (pgSz) {
      const w = parseInt(getWAttr(pgSz, 'w'), 10);
      const h = parseInt(getWAttr(pgSz, 'h'), 10);
      if (!isNaN(w) && w > 0) templateProfile.pageWidthDxa = w;
      if (!isNaN(h) && h > 0) templateProfile.pageHeightDxa = h;
    }
    const pgMar = findDirectChild(mainSectPr, 'pgMar');
    if (pgMar) {
      const top = parseInt(getWAttr(pgMar, 'top'), 10);
      const bottom = parseInt(getWAttr(pgMar, 'bottom'), 10);
      const left = parseInt(getWAttr(pgMar, 'left'), 10);
      const right = parseInt(getWAttr(pgMar, 'right'), 10);
      if (!isNaN(top) && !isNaN(bottom) && !isNaN(left) && !isNaN(right)) {
        templateProfile.margins = { top, bottom, left, right };
      }
    }
  }

  // Frequency counters for body font / fontSize / lineSpacing
  const fontCounts = new Map<string, number>();
  const sizeCounts = new Map<number, number>();
  const lineSpacingCounts = new Map<number, number>();
  const tableRowCountTracker = new Map<number, number>();

  const extractedImages: ExtractedPlanImage[] = [];
  const rIdToImage = new Map<string, ExtractedPlanImage>();
  let imageCounter = 0;
  const stamp = Date.now();

  const resolveDrawingImage = async (
    drawingOrPictEl: Element
  ): Promise<ExtractedPlanImage | null> => {
    // Extract display extent in EMUs (1 px at 96 DPI = 9525 EMUs) if available
    let displayW: number | undefined;
    let displayH: number | undefined;

    const allEls = Array.from(drawingOrPictEl.getElementsByTagName('*'));
    for (const el of allEls) {
      const ln = getLocalName(el);
      if (ln === 'extent') {
        const cx = parseInt(el.getAttribute('cx') || '', 10);
        const cy = parseInt(el.getAttribute('cy') || '', 10);
        if (!isNaN(cx) && !isNaN(cy) && cx > 0 && cy > 0) {
          displayW = Math.round(cx / 9525);
          displayH = Math.round(cy / 9525);
          break;
        }
      }
    }

    // Prefer raster <a:blip r:embed="..."> first (Word stores PNG fallback alongside svgBlip)
    let rId = '';
    for (const el of allEls) {
      const ln = getLocalName(el);
      if (ln === 'blip') {
        const embed = getRAttr(el, 'embed') || getRAttr(el, 'link');
        if (embed) {
          rId = embed;
          break;
        }
      }
    }
    if (!rId) {
      for (const el of allEls) {
        const ln = getLocalName(el);
        if (ln === 'imagedata' || ln === 'svgBlip') {
          const idAttr = getRAttr(el, 'id') || getRAttr(el, 'embed');
          if (idAttr) {
            rId = idAttr;
            break;
          }
        }
      }
    }

    if (!rId) return null;
    if (rIdToImage.has(rId)) {
      return rIdToImage.get(rId)!;
    }

    const mediaPath = relMap.get(rId);
    if (!mediaPath) return null;
    const mimeType = inferImageMimeType(mediaPath);
    if (/wmf|emf/i.test(mimeType)) {
      return null;
    }

    const zipEntry = zip.file(mediaPath);
    if (!zipEntry) return null;

    const bytes = await zipEntry.async('uint8array');
    const naturalDims = getImageDimensionsFromBytes(bytes);
    const finalW = displayW || naturalDims?.width;
    const finalH = displayH || naturalDims?.height;

    // Skip tiny 1x1 / <6px decorative spacer pixels
    if (finalW !== undefined && finalH !== undefined && finalW < 6 && finalH < 6) {
      return null;
    }

    imageCounter++;
    const id = `giao_an_cu_img_${stamp}_${imageCounter}`;
    const base64Data = arrayBufferToBase64(bytes);
    const name = `Hình ${imageCounter}`;
    const item: ExtractedPlanImage = {
      id,
      name,
      mimeType,
      data: base64Data,
      previewUrl: `data:${mimeType};base64,${base64Data}`,
      ...(finalW && finalH ? { width: finalW, height: finalH } : {}),
    };

    extractedImages.push(item);
    rIdToImage.set(rId, item);
    return item;
  };

  /**
   * Recursively extracts inline pieces from a <w:p> or inline container (<w:hyperlink>, <w:sdtContent>, <w:ins>, etc.)
   */
  const collectInlinePieces = async (
    container: Element,
    pieces: StyledRunPiece[]
  ): Promise<void> => {
    for (let i = 0; i < container.childNodes.length; i++) {
      const node = container.childNodes[i];
      if (node.nodeType !== 1) continue;
      const el = node as Element;
      const ln = getLocalName(el);

      if (ln === 'pPr' || ln === 'bookmarkStart' || ln === 'bookmarkEnd' || ln === 'proofErr' || ln === 'del') {
        continue;
      }

      if (ln === 'oMathPara') {
        const latex = ommlElementToLatex(el).trim();
        if (latex) {
          pieces.push({ kind: 'display_math', text: latex });
        }
        continue;
      }

      if (ln === 'oMath') {
        const latex = ommlElementToLatex(el).trim();
        if (latex) {
          pieces.push({ kind: 'math', text: latex });
        }
        continue;
      }

      if (ln === 'r') {
        const rPr = findDirectChild(el, 'rPr');
        const isBold = isToggleEnabled(rPr, 'b');
        const isItalic = isToggleEnabled(rPr, 'i');

        // Record font & size stats
        if (rPr) {
          const rFonts = findDirectChild(rPr, 'rFonts');
          const fName = getWAttr(rFonts, 'ascii') || getWAttr(rFonts, 'hAnsi');
          if (fName && !fName.startsWith('+') && fName !== 'Cambria Math' && fName !== 'Symbol') {
            fontCounts.set(fName, (fontCounts.get(fName) || 0) + 1);
          }
          const szEl = findDirectChild(rPr, 'sz');
          const sz = parseInt(getWAttr(szEl, 'val'), 10);
          if (!isNaN(sz) && sz >= 18 && sz <= 36) {
            sizeCounts.set(sz, (sizeCounts.get(sz) || 0) + 1);
          }
        }

        for (let j = 0; j < el.childNodes.length; j++) {
          const rc = el.childNodes[j];
          if (rc.nodeType !== 1) continue;
          const rEl = rc as Element;
          const rLn = getLocalName(rEl);

          if (rLn === 't') {
            const txt = rEl.textContent || '';
            if (txt) {
              pieces.push({ kind: 'text', text: txt, bold: isBold, italic: isItalic });
            }
          } else if (rLn === 'tab') {
            // Preserve tabs in headers & Phiếu học tập multiple-choice options so words NEVER stick together!
            pieces.push({ kind: 'text', text: '    ', bold: false, italic: false });
          } else if (rLn === 'br' || rLn === 'cr') {
            pieces.push({ kind: 'br', text: '\n' });
          } else if (rLn === 'noBreakHyphen') {
            pieces.push({ kind: 'text', text: '-', bold: isBold, italic: isItalic });
          } else if (rLn === 'drawing' || rLn === 'pict' || rLn === 'object') {
            const img = await resolveDrawingImage(rEl);
            if (img) {
              pieces.push({
                kind: 'image',
                text: `[[IMAGE:${img.id}:${img.name}]]`,
              });
            }
          }
        }
        continue;
      }

      if (ln === 'drawing' || ln === 'pict') {
        const img = await resolveDrawingImage(el);
        if (img) {
          pieces.push({
            kind: 'image',
            text: `[[IMAGE:${img.id}:${img.name}]]`,
          });
        }
        continue;
      }

      if (ln === 'sdt') {
        const sdtContent = findDirectChild(el, 'sdtContent');
        if (sdtContent) {
          await collectInlinePieces(sdtContent, pieces);
        }
        continue;
      }

      // Recurse into <w:hyperlink>, <w:ins>, <w:smartTag>, <w:fldSimple>, etc.
      await collectInlinePieces(el, pieces);
    }
  };

  const extractParagraphString = async (
    pEl: Element,
    insideTableCell: boolean
  ): Promise<string> => {
    const pPr = findDirectChild(pEl, 'pPr');
    let prefix = '';

    if (pPr) {
      const spacingEl = findDirectChild(pPr, 'spacing');
      if (spacingEl) {
        const lineVal = parseInt(getWAttr(spacingEl, 'line'), 10);
        if (!isNaN(lineVal) && lineVal >= 200 && lineVal <= 480) {
          lineSpacingCounts.set(lineVal, (lineSpacingCounts.get(lineVal) || 0) + 1);
        }
      }

      const numPr = findDirectChild(pPr, 'numPr');
      if (numPr) {
        prefix = '– ';
      }
    }

    const pieces: StyledRunPiece[] = [];
    await collectInlinePieces(pEl, pieces);
    const brToken = insideTableCell ? '<br>' : '\n';
    let text = serializeStyledPieces(pieces, brToken);

    if (insideTableCell) {
      text = text
        .replace(/[\r\n]+/g, '<br>')
        .replace(/\|/g, '\\|')
        .replace(/(?:<br>\s*){3,}/g, '<br><br>')
        .trim();
    } else {
      text = text.replace(/[ \t]+\n/g, '\n').trim();
    }

    if (!text) return '';
    if (prefix && !/^([-–*+•]|\d+[.)]|[a-z][.)]|[IVXLCDM]+\.)\s/i.test(text.replace(/^\*+/, ''))) {
      return `${prefix}${text}`;
    }
    return text;
  };

  const extractTableMarkdown = async (
    tblEl: Element,
    isNested = false
  ): Promise<string> => {
    // Capture column grid widths & borders for top-level tables
    if (!isNested) {
      const tblPr = findDirectChild(tblEl, 'tblPr');
      const tblBorders = findDirectChild(tblPr, 'tblBorders');
      if (tblBorders && !templateProfile.tableBorderColor) {
        const topB = findDirectChild(tblBorders, 'top') || findDirectChild(tblBorders, 'insideH');
        if (topB) {
          const col = getWAttr(topB, 'color');
          const sz = parseInt(getWAttr(topB, 'sz'), 10);
          if (col && col !== 'auto') templateProfile.tableBorderColor = col;
          if (!isNaN(sz) && sz > 0) templateProfile.tableBorderSize = sz;
        }
      }

      const tblGrid = findDirectChild(tblEl, 'tblGrid');
      const gridCols = findDirectChildren(tblGrid, 'gridCol')
        .map((gc) => parseInt(getWAttr(gc, 'w'), 10))
        .filter((w) => !isNaN(w) && w > 0);

      const trListForCount = findDirectChildren(tblEl, 'tr');
      if (gridCols.length >= 2) {
        const colCount = gridCols.length;
        const prevBestRows = tableRowCountTracker.get(colCount) || 0;
        if (trListForCount.length >= prevBestRows) {
          const total = gridCols.reduce((a, b) => a + b, 0);
          if (total > 0 && templateProfile.tableColRatiosByColCount) {
            templateProfile.tableColRatiosByColCount[colCount] = gridCols.map((w) =>
              Number((w / total).toFixed(4))
            );
            tableRowCountTracker.set(colCount, trListForCount.length);
          }
        }
      }
    }

    const trElements = findDirectChildren(tblEl, 'tr');
    if (trElements.length === 0) return '';

    const extractedRows: string[][] = [];
    let maxCols = 0;

    for (const tr of trElements) {
      const tcElements = findDirectChildren(tr, 'tc');
      const rowCells: string[] = [];

      for (const tc of tcElements) {
        const tcPr = findDirectChild(tc, 'tcPr');
        const gridSpanEl = findDirectChild(tcPr, 'gridSpan');
        const span = Math.max(1, parseInt(getWAttr(gridSpanEl, 'val') || '1', 10) || 1);

        const vMergeEl = findDirectChild(tcPr, 'vMerge');
        const vMergeVal = vMergeEl ? getWAttr(vMergeEl, 'val') : null;
        if (vMergeEl && vMergeVal !== 'restart') {
          for (let s = 0; s < span; s++) rowCells.push(' ');
          continue;
        }

        const cellParts: string[] = [];
        const walkCellChildren = async (cellContainer: Element) => {
          for (let cIdx = 0; cIdx < cellContainer.childNodes.length; cIdx++) {
            const cn = cellContainer.childNodes[cIdx];
            if (cn.nodeType !== 1) continue;
            const cEl = cn as Element;
            const cLn = getLocalName(cEl);

            if (cLn === 'p') {
              const pStr = await extractParagraphString(cEl, true);
              if (pStr) cellParts.push(pStr);
            } else if (cLn === 'tbl') {
              const nestedStr = await extractTableMarkdown(cEl, true);
              if (nestedStr) cellParts.push(nestedStr);
            } else if (cLn === 'sdt') {
              const sdtContent = findDirectChild(cEl, 'sdtContent');
              if (sdtContent) await walkCellChildren(sdtContent);
            }
          }
        };

        await walkCellChildren(tc);
        const joinedCell = cellParts.join('<br>').trim() || ' ';
        rowCells.push(joinedCell);
        for (let s = 1; s < span; s++) {
          rowCells.push(' ');
        }
      }

      if (rowCells.length > maxCols) maxCols = rowCells.length;
      if (rowCells.length > 0) extractedRows.push(rowCells);
    }

    if (maxCols === 0 || extractedRows.length === 0) return '';

    // If nested inside an outer table cell, format cleanly with ' — ' & '<br>' so outer Markdown pipes never break!
    if (isNested) {
      return extractedRows
        .map((r) => r.map((c) => c.trim()).filter(Boolean).join(' — '))
        .filter(Boolean)
        .join('<br>');
    }

    const mdLines: string[] = [];
    extractedRows.forEach((r, idx) => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push(' ');
      mdLines.push(`| ${padded.join(' | ')} |`);
      if (idx === 0) {
        mdLines.push(`| ${Array(maxCols).fill('---').join(' | ')} |`);
      }
    });

    return mdLines.join('\n');
  };

  // 4. Walk <w:body> children in exact document order
  const body = xmlDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) throw new Error('Missing <w:body> in document.xml');

  const blocks: string[] = [];
  const walkBodyBlocks = async (container: Element) => {
    for (let i = 0; i < container.childNodes.length; i++) {
      const node = container.childNodes[i];
      if (node.nodeType !== 1) continue;
      const el = node as Element;
      const ln = getLocalName(el);

      if (ln === 'p') {
        const pStr = await extractParagraphString(el, false);
        if (pStr) blocks.push(pStr);
      } else if (ln === 'tbl') {
        const tblStr = await extractTableMarkdown(el, false);
        if (tblStr) blocks.push(`\n${tblStr}\n`);
      } else if (ln === 'sdt') {
        const sdtContent = findDirectChild(el, 'sdtContent');
        if (sdtContent) await walkBodyBlocks(sdtContent);
      }
    }
  };

  await walkBodyBlocks(body);

  // Finalize dominant font, size, lineSpacing in templateProfile
  if (fontCounts.size > 0) {
    let bestFont = '';
    let bestCnt = 0;
    for (const [f, cnt] of fontCounts.entries()) {
      if (cnt > bestCnt) {
        bestCnt = cnt;
        bestFont = f;
      }
    }
    if (bestFont) templateProfile.fontName = bestFont;
  }
  if (sizeCounts.size > 0) {
    let bestSz = 0;
    let bestCnt = 0;
    for (const [sz, cnt] of sizeCounts.entries()) {
      if (cnt > bestCnt) {
        bestCnt = cnt;
        bestSz = sz;
      }
    }
    if (bestSz) templateProfile.fontSize = bestSz;
  }
  if (lineSpacingCounts.size > 0) {
    let bestLs = 0;
    let bestCnt = 0;
    for (const [ls, cnt] of lineSpacingCounts.entries()) {
      if (cnt > bestCnt) {
        bestCnt = cnt;
        bestLs = ls;
      }
    }
    if (bestLs) templateProfile.lineSpacing = bestLs;
  }

  const fullText = blocks
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const upperHead = fullText.slice(0, 700).toUpperCase();
  templateProfile.hasSchoolHeader =
    upperHead.includes('TRƯỜNG') ||
    upperHead.includes('SỞ GIÁO DỤC') ||
    upperHead.includes('PHÒNG GD') ||
    upperHead.includes('TỔ:') ||
    upperHead.includes('TỔ CHUYÊN MÔN') ||
    upperHead.includes('HỌ VÀ TÊN GIÁO VIÊN') ||
    upperHead.includes('GIÁO VIÊN:');

  return {
    text: fullText,
    images: extractedImages,
    templateProfile,
  };
}

/**
 * Fallback HTML -> Markdown converter (used only if direct XML extraction falls back to Mammoth)
 */
function convertHtmlToMarkdown(html: string, extractedImages: ExtractedPlanImage[]): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const replaceImgWithPlaceholder = (img: HTMLImageElement) => {
    const src = img.getAttribute('src') || '';
    if (!src) return '';
    const matched = extractedImages.find((item) => item.id === src || item.previewUrl === src);
    if (!matched) return '';
    return ` [[IMAGE:${matched.id}:${matched.name}]] `;
  };

  const tables = doc.querySelectorAll('table');
  tables.forEach((table) => {
    // Skip nested tables so outer table processing handles them cleanly
    if (table.parentElement?.closest('table')) return;

    const rows = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr'));
    if (rows.length === 0) return;

    const tableLines: string[] = [];
    let maxCols = 0;

    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll(':scope > td, :scope > th'));
      if (cells.length > maxCols) maxCols = cells.length;
    });

    if (maxCols === 0) return;

    rows.forEach((row, rowIdx) => {
      const cells = Array.from(row.querySelectorAll(':scope > td, :scope > th'));
      const cellTexts = cells.map((cell) => {
        const cellImgs = Array.from(cell.querySelectorAll('img'));
        cellImgs.forEach((img) => {
          const ph = doc.createTextNode(replaceImgWithPlaceholder(img));
          img.parentNode?.replaceChild(ph, img);
        });

        const cellHtml = cell.innerHTML || '';
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = cellHtml
          .replace(/<\/(?:p|div|h[1-6]|tr)>\s*<(?:p|div|h[1-6]|ul|ol|tr)[^>]*>/gi, '__BR_TOKEN__')
          .replace(/<li[^>]*>/gi, '__BR_TOKEN__– ')
          .replace(/<br\s*\/?>/gi, '__BR_TOKEN__');

        const rawText = tempDiv.textContent || '';
        const cleanText = rawText
          .replace(/[\r\n]+/g, ' ')
          .replace(/\|/g, '\\|')
          .replace(/\s+/g, ' ')
          .replace(/^(?:\s*__BR_TOKEN__\s*)+/, '')
          .replace(/\s*__BR_TOKEN__\s*/g, '<br>')
          .trim();

        return cleanText || ' ';
      });

      while (cellTexts.length < maxCols) {
        cellTexts.push(' ');
      }

      tableLines.push(`| ${cellTexts.join(' | ')} |`);

      if (rowIdx === 0) {
        const separators = Array(maxCols).fill('---');
        tableLines.push(`| ${separators.join(' | ')} |`);
      }
    });

    const placeholder = doc.createElement('div');
    placeholder.textContent = `\n\n${tableLines.join('\n')}\n\n`;
    table.parentNode?.replaceChild(placeholder, table);
  });

  const standaloneImgs = Array.from(doc.querySelectorAll('img'));
  standaloneImgs.forEach((img) => {
    const phText = replaceImgWithPlaceholder(img);
    const p = doc.createElement('p');
    p.textContent = phText.trim();
    img.parentNode?.replaceChild(p, img);
  });

  let result = '';
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      result += currentNode.textContent;
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const el = currentNode as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'].includes(tag)) {
        result += '\n';
      } else if (tag === 'li') {
        result += '\n– ';
      } else if (tag === 'br') {
        result += '\n';
      }
    }
    currentNode = walker.nextNode();
  }

  return result
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extracts text, OMML Word equations, preserved multi-column tables, Phiếu học tập,
 * template layout profile, AND all embedded images from the teacher's lesson plan.
 * Supports: .docx, .pdf, .txt, .md
 */
export async function extractTextFromFile(
  file: File,
  userApiKey?: string
): Promise<ExtractedPlanResult> {
  const fileName = file.name.toLowerCase();

  // 1. PDF files
  if (fileName.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = arrayBufferToBase64(arrayBuffer);

    let pdfText = '';

    try {
      const cleanHeaderKey = (userApiKey || '').replace(/[^\x20-\x7E]/g, '').trim();
      const res = await fetch('/api/extract-plan-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-gemini-key': cleanHeaderKey,
        },
        body: JSON.stringify({
          pdfBase64,
          userApiKey: cleanHeaderKey,
        }),
      });

      let data: any = null;
      const textResponse = await res.text();
      try {
        data = JSON.parse(textResponse);
      } catch (_) {}

      if (res.ok && data?.text) {
        pdfText = data.text;
      }
    } catch (serverErr) {
      console.warn(
        'Server extract-plan-pdf unavailable or timed out, executing direct client-side extraction:',
        serverErr
      );
    }

    if (!pdfText) {
      const { handleExtractPlanPdf } = await import('../server/geminiHandler');
      const clientResult = await handleExtractPlanPdf(pdfBase64, userApiKey);
      pdfText = clientResult.text;
    }

    return {
      text: pdfText || '',
      images: [],
    };
  }

  // 2. Word .docx files: Direct OpenXML extraction first (preserves 100% OMML equations, tabs, tables, images, worksheets!)
  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();

    try {
      const directResult = await extractDocxDirectFromXml(arrayBuffer);
      if (directResult.text.trim().length > 0) {
        return directResult;
      }
    } catch (xmlErr) {
      console.warn('Direct OpenXML .docx extraction failed, falling back to Mammoth:', xmlErr);
    }

    const extractedImages: ExtractedPlanImage[] = [];
    let imageCounter = 0;

    try {
      const options = {
        convertImage: mammoth.images.imgElement(function (image: any) {
          const mimeType = image.contentType || 'image/jpeg';
          const isFormula = /x-wmf|x-emf|wmf|emf/i.test(mimeType);
          if (isFormula) {
            return Promise.resolve({ src: '', alt: '' });
          }

          return image.read('base64').then(function (imageBuffer: string) {
            imageCounter++;
            const id = `giao_an_cu_img_${Date.now()}_${imageCounter}`;
            const previewUrl = `data:${mimeType};base64,${imageBuffer}`;
            const name = `Hình ${imageCounter}`;

            extractedImages.push({
              id,
              name,
              mimeType,
              data: imageBuffer,
              previewUrl,
            });

            return {
              src: id,
              alt: name,
            };
          });
        }),
      };

      const htmlResult = await mammoth.convertToHtml({ arrayBuffer }, options);
      const markdownText = convertHtmlToMarkdown(htmlResult.value, extractedImages);

      return {
        text: markdownText,
        images: extractedImages,
      };
    } catch (err) {
      console.warn('Mammoth HTML/Image extraction failed, fallback to raw text:', err);
      const rawResult = await mammoth.extractRawText({ arrayBuffer });
      return {
        text: rawResult.value,
        images: [],
      };
    }
  }

  if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    const text = await file.text();
    return {
      text,
      images: [],
    };
  }

  const fallbackText = await file.text();
  return {
    text: fallbackText,
    images: [],
  };
}
