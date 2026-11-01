import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageNumber,
  Header,
  Footer,
  ImageRun,
  BorderStyle,
  Math as DocxMath,
  XmlComponent,
} from "docx";
import JSZip from "jszip";
import FileSaver from "file-saver";
const saveAs = (FileSaver as any).saveAs || FileSaver;
import {
  MathOutputFormat,
  latexToUnicode,
  convertLatexToDocxMath,
  autoWrapUnwrappedMathForEquation,
  normalizeContentForRawLatex,
  FORBIDDEN_UNICODE_MATH_REGEX,
} from "./mathConverter";
import {
  ExtractedVisual,
  extractInlineVisuals,
  rasterizeSvgToPngBytes,
  base64ToBytes,
} from "./mathSvgRenderer";

// Constants for Page Setup (A4, standard Vietnamese educational guidelines)
// 1 cm = 567 twips (dxa)
const PAGE_WIDTH_DXA = 11906; // A4 210mm
const PAGE_HEIGHT_DXA = 16838; // A4 297mm

const DEFAULT_FONT_NAME = "Times New Roman";
const DEFAULT_BASE_FONT_SIZE = 26; // 13 pt (half-points: 13 * 2 = 26)
const RED_COLOR = "DC2626"; // Vibrant standard red for digital competency insertions

export interface ImageAttachment {
  id?: string;
  name?: string;
  data: string; // Base64 string
  mimeType?: string;
}

export interface FormattingOptions {
  fontName: string;
  fontSize: number; // e.g. 26 for 13pt
  lineSpacing: number; // e.g. 240 for Single, 276 for 1.15, 360 for 1.5
  paraSpacing: number; // e.g. 120 for 6pt, 0 for 0pt, 240 for 12pt
  margins: { top: number; bottom: number; left: number; right: number }; // dxa
  pageNumber: "none" | "bottom-center" | "bottom-right" | "top-center";
  mathFormat?: MathOutputFormat; // 'equation' (OMML) | 'latex' (Raw LaTeX)
}

export interface ParseOptions {
  lessonTitle: string;
  subject: string;
  grade: string;
  images?: ImageAttachment[];
  formatting?: FormattingOptions;
}

export interface DocxVerificationReport {
  passed: boolean;
  mathFormat: MathOutputFormat;
  xmlValid: boolean;
  ommlEquationCount: number;
  rawInlineLatexCount: number;
  rawDisplayLatexCount: number;
  leakedRawLatexInEquationMode: number;
  forbiddenUnicodeInLatexMode: number;
  embeddedImageCount: number;
  mediaFileCount: number;
  tableCount: number;
  redRunCount: number;
  pageNumberMode: string;
  issues: string[];
  summary: string;
}

/**
 * Sanitizes line formatting:
 * - Removes '*' or '.' in front of headings
 * - Removes '*' at the end of sentences
 * - Removes any raw <br> tags (unless preserveBr=true inside table cells)
 */
export function cleanLineFormatting(line: string, preserveBr = false): string {
  let l = line.trimEnd();

  // 1. Remove or normalize raw <br> tags
  if (!preserveBr) {
    l = l.replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ");
    l = l.replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ");
    l = l.replace(/&lt;br\s*\/?&gt;/gi, "");
    l = l.replace(/<br\s*\/?>/gi, "");
  } else {
    l = l.replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "<br>– ");
    l = l.replace(/<br\s*\/?>\s*[-–]\s*/gi, "<br>– ");
    l = l.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  }

  // 2. Remove leading '.' or '*' or '*.' before roman numerals, numbers, headings, or activity titles
  l = l.replace(/^[\s*.]+(?=[IVXLCDM]+\b[\.\:\s])/i, "");
  l = l.replace(/^[\s*.]+(?=\d+[\.\)\:\s])/i, "");
  l = l.replace(/^[\s*.]+(?=[a-z][\.\)]\s)/i, "");
  l = l.replace(
    /^[\s*.]+(?=(?:Hoạt động|HOẠT ĐỘNG|MỤC TIÊU|Mục tiêu|TIẾN TRÌNH|Tiến trình|THIẾT BỊ|Thiết bị|HỒ SƠ|Hồ sơ|PHỤ LỤC|Phụ lục|HƯỚNG DẪN|Hướng dẫn)[\s\:\.])/i,
    ""
  );

  // 3. Remove markdown asterisks wrapper around headings
  l = l.replace(/^\*\*(.*?)\*\*$/, "$1");
  l = l.replace(/^[\s*.]+\*\*(.*?)\*\*/, "$1");

  // 4. Remove trailing '*' at the end of sentences or lines (avoid touching $$...$$)
  l = l.replace(/\*+\s*([.,;:!?])/g, "$1");
  l = l.replace(/([.,;:!?])\*+\s*$/g, "$1");
  l = l.replace(/\*+\s*$/g, "");

  // 5. Clean inside [[RED:...]] tags to avoid extra asterisks, normalize casing
  l = l.replace(/\[\[\s*red\s*:/gi, "[[RED:");
  l = l.replace(/\[\[RED:\s*\*\*(.*?)\*\*\s*\]\]/gi, "[[RED:$1]]");
  l = l.replace(/\[\[RED:\s*\*(.*?)\*\s*\]\]/gi, "[[RED:$1]]");
  l = l.replace(/\[\[RED:(.*?)\*+\]\]/gi, "[[RED:$1]]");

  // 6. Fix arbitrary Title Case capitalization on common headings, steps, and pedagogical terms
  l = l.replace(/\bMục\s+Tiêu\b/g, "Mục tiêu");
  l = l.replace(/\bNội\s+Dung\b/g, "Nội dung");
  l = l.replace(/\bSản\s+Phẩm\b/g, "Sản phẩm");
  l = l.replace(/\bTổ\s+Chức\s+Thực\s+Hiện\b/g, "Tổ chức thực hiện");
  l = l.replace(/\bVề\s+Kiến\s+Thức\b/gi, "Về kiến thức");
  l = l.replace(/\bVề\s+Năng\s+Lực\b/gi, "Về năng lực");
  l = l.replace(/\bVề\s+Phẩm\s+Chất\b/gi, "Về phẩm chất");
  l = l.replace(/\bĐối\s+Với\s+Giáo\s+Viên\b/gi, "Đối với giáo viên");
  l = l.replace(/\bĐối\s+Với\s+Học\s+Sinh\b/gi, "Đối với học sinh");
  l = l.replace(/\bChuyển\s+Giao\s+Nhiệm\s+Vụ\b/gi, "Chuyển giao nhiệm vụ");
  l = l.replace(/\bThực\s+Hiện\s+Nhiệm\s+Vụ\b/gi, "Thực hiện nhiệm vụ");
  l = l.replace(/\bBáo\s+Cáo\s+Kết\s+Quả\b/gi, "Báo cáo kết quả");
  l = l.replace(/\bĐánh\s+Giá\s+Kết\s+Quả\b/gi, "Đánh giá kết quả");
  l = l.replace(/\bSản\s+Phẩm\s+Dự\s+Kiến\b/g, "Sản phẩm dự kiến");
  l = l.replace(/\bHoạt\s+Động\s+Của\s+GV\s+Và\s+HS\b/g, "Hoạt động của GV và HS");
  l = l.replace(/\bPhiếu\s+Học\s+Tập\b/g, "Phiếu học tập");
  l = l.replace(/\bHoạt\s+Động\s+Khởi\s+Động\b/g, "Hoạt động khởi động");
  l = l.replace(/\bHình\s+Thành\s+Kiến\s+Thức\s+Mới\b/g, "Hình thành kiến thức mới");
  l = l.replace(/\bHoạt\s+Động\s+Luyện\s+Tập\b/g, "Hoạt động luyện tập");
  l = l.replace(/\bHoạt\s+Động\s+Vận\s+Dụng\b/g, "Hoạt động vận dụng");
  l = l.replace(/\bYêu\s+Cầu\s+Cần\s+Đạt\b/g, "Yêu cầu cần đạt");
  l = l.replace(/\bThiết\s+Bị\s+Dạy\s+Học\b/g, "Thiết bị dạy học");
  l = l.replace(/\bHọc\s+Liệu\s+Số\b/g, "Học liệu số");
  l = l.replace(/\bNăng\s+Lực\s+Số\b/g, "Năng lực số");
  l = l.replace(/\bNăng\s+Lực\s+Chung\b/g, "Năng lực chung");
  l = l.replace(/\bNăng\s+Lực\s+Đặc\s+Thù\b/g, "Năng lực đặc thù");

  return l;
}

/**
 * Normalizes [[RED:...]] tags so they don't get broken across multiple lines or <br> breaks.
 */
export function normalizeRedTags(content: string): string {
  if (!content) return "";

  const text = content.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  const normalized = text.replace(/\[\[RED:([\s\S]*?)\]\]/gi, (_, inner) => {
    const lines = inner.split("\n");
    return lines
      .map((line: string) => {
        if (!line.trim()) return line;
        if (/<br\s*\/?>/i.test(line)) {
          return line
            .split(/(<br\s*\/?>)/i)
            .map((seg: string) => {
              if (/<br\s*\/?>/i.test(seg) || !seg.trim()) return seg;
              const cleanSeg = seg.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "").trim();
              return cleanSeg ? `[[RED:${cleanSeg}]]` : "";
            })
            .join("");
        }
        const cleanLine = line.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "").trim();
        return cleanLine ? `[[RED:${cleanLine}]]` : "";
      })
      .join("\n");
  });

  const lines = normalized.split("\n");
  const fixedLines = lines.map((line) => {
    let l = line;
    const opens = (l.match(/\[\[RED:/g) || []).length;
    const closes = (l.match(/\]\]/g) || []).length;
    if (opens > closes) {
      l += "]]".repeat(opens - closes);
    }
    return l;
  });

  return fixedLines.join("\n");
}

/**
 * Preprocesses markdown text (after inline SVGs have been tokenized):
 * 1. Collapses multi-line math blocks ($$...$$, \[...\], \begin{cases}...\end{cases}) into single lines BEFORE RED tag splitting so formulas inside [[RED:...]] never tear!
 * 2. Normalizes multi-line [[RED:...]] tags.
 * 3. Converts <br> tags outside of tables into actual newlines (\n).
 */
export function preprocessLessonPlanContent(
  content: string,
  mathFormat: MathOutputFormat = "equation"
): string {
  if (!content) return "";

  const withCollapsedMath = content
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => {
      const singleLine = inner.replace(/\r?\n/g, " ").trim();
      return `$$${singleLine}$$`;
    })
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => {
      const singleLine = inner.replace(/\r?\n/g, " ").trim();
      return mathFormat === "latex" ? `$$${singleLine}$$` : `\\[${singleLine}\\]`;
    })
    .replace(/\\begin\{cases\}([\s\S]+?)\\end\{cases\}/g, (_, inner) => {
      const singleLine = inner.replace(/\r?\n/g, " ").trim();
      return `\\begin{cases}${singleLine}\\end{cases}`;
    });

  const withNormalizedMode =
    mathFormat === "latex" ? normalizeContentForRawLatex(withCollapsedMath) : withCollapsedMath;

  const withNormalizedRed = normalizeRedTags(withNormalizedMode);

  const lines = withNormalizedRed.split("\n");
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cleanTableRow = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "<br>– ")
        .replace(/<br\s*\/?>\s*[-–]\s*/gi, "<br>– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
      processedLines.push(cleanTableRow);
    } else {
      const cleaned = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "\n– ")
        .replace(/<br\s*\/?>\s*[-–]\s*/gi, "\n– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");

      // In 'latex' mode, ensure any inline $$...$$ embedded inside a regular paragraph is split onto its own centered line
      const splitDisplayMath =
        mathFormat === "latex" && /\$\$[\s\S]+?\$\$/.test(cleaned) && !/^\$\$[\s\S]+\$\$$/.test(cleaned.trim())
          ? cleaned.replace(/(\$\$[^$\n]+?\$\$)/g, "\n$1\n")
          : cleaned;

      if (splitDisplayMath.includes("\n")) {
        const parts = splitDisplayMath.split("\n");
        for (const part of parts) {
          const pTrimmed = part.trim();
          if (pTrimmed) {
            processedLines.push(pTrimmed);
          }
        }
      } else {
        processedLines.push(line);
      }
    }
  }

  return processedLines.join("\n");
}

/**
 * Finds an uploaded textbook/plan image attachment by index (e.g. 1, 2) or by id/name
 */
function findImage(idOrIndex: string, images?: ImageAttachment[]): ImageAttachment | null {
  if (!images || images.length === 0) return null;
  const cleanKey = idOrIndex.trim().toLowerCase();

  const byId = images.find((img) => img.id && img.id.toLowerCase() === cleanKey);
  if (byId) return byId;

  const num = parseInt(cleanKey, 10);
  if (!isNaN(num) && num > 0 && num <= images.length) {
    return images[num - 1];
  }

  return (
    images.find(
      (img) =>
        img.name &&
        (img.name.toLowerCase() === cleanKey || img.name.toLowerCase().includes(cleanKey))
    ) || null
  );
}

/**
 * Splits a Markdown table row `| cell1 | cell2 |` safely without splitting `|` inside `$...$` math (e.g. `|x|`)
 */
export function splitMarkdownTableRow(rowLine: string): string[] {
  const inner = rowLine.trim().slice(1, -1);
  const cells: string[] = [];
  let cur = "";
  let inMath = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "$" && inner[i - 1] !== "\\") {
      // Handle $$ or $
      if (inner[i + 1] === "$") {
        inMath = !inMath;
        cur += "$$";
        i++;
        continue;
      }
      inMath = !inMath;
      cur += ch;
      continue;
    }
    if (ch === "|" && !inMath) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

/**
 * Parses text with [[RED:...]] tags and math expressions into Word Runs.
 * - In 'equation' mode: converts 100% of math into native Word OMML (<m:oMath>) objects.
 * - In 'latex' mode: outputs ZERO OMML objects; keeps $...$ and $$...$$ as single unbroken plain TextRuns in the document font.
 * - Red content is ONLY RED (#DC2626), NEVER BOLD (bold: false).
 */
function parseInlineRuns(
  text: string,
  defaultBold = false,
  fontName = DEFAULT_FONT_NAME,
  fontSize = DEFAULT_BASE_FONT_SIZE,
  mathFormat: MathOutputFormat = "equation"
): (TextRun | DocxMath | XmlComponent)[] {
  const runs: (TextRun | DocxMath | XmlComponent)[] = [];

  let sanitized = text
    .replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ")
    .replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ")
    .replace(/&lt;br\s*\/?&gt;/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/\[\.\.\.\]/g, "")
    .replace(/\[i\]/gi, "");

  sanitized = sanitized.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  const opens = (sanitized.match(/\[\[RED:/g) || []).length;
  const closes = (sanitized.match(/\]\]/g) || []).length;
  if (opens > closes) {
    sanitized += "]]".repeat(opens - closes);
  }

  const regex = /\[\[RED:([\s\S]*?)\]\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sanitized)) !== null) {
    const precedingText = sanitized.substring(lastIndex, match.index);
    if (precedingText) {
      const cleanPre = precedingText.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "");
      if (cleanPre) {
        appendFormattedRuns(runs, cleanPre, false, defaultBold, fontName, fontSize, mathFormat);
      }
    }
    const redContent = match[1];
    if (redContent) {
      const cleanRed = redContent.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "");
      if (cleanRed) {
        appendFormattedRuns(runs, cleanRed, true, false, fontName, fontSize, mathFormat);
      }
    }
    lastIndex = regex.lastIndex;
  }

  const remaining = sanitized.substring(lastIndex);
  if (remaining) {
    const cleanRem = remaining.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "");
    if (cleanRem) {
      appendFormattedRuns(runs, cleanRem, false, defaultBold, fontName, fontSize, mathFormat);
    }
  }

  if (runs.length > 0) return runs;

  const fallbackText = sanitized.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "");
  return [
    new TextRun({
      text: mathFormat === "latex" ? fallbackText : latexToUnicode(fallbackText),
      font: fontName,
      size: fontSize,
      bold: defaultBold,
    }),
  ];
}

function appendFormattedRuns(
  runs: (TextRun | DocxMath | XmlComponent)[],
  textSegment: string,
  isRed: boolean,
  isDefaultBold: boolean,
  fontName: string,
  fontSize: number,
  mathFormat: MathOutputFormat
) {
  let cleanSegment = textSegment
    .replace(/\[\[\s*RED:?/gi, "")
    .replace(/\]\]/g, "")
    .replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ")
    .replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ")
    .replace(/&lt;br\s*\/?&gt;/gi, "")
    .replace(/<br\s*\/?>/gi, "");

  if (!cleanSegment) return;

  // In 'equation' mode, safeguard against any unwrapped math outside $...$
  if (mathFormat === "equation") {
    const tokenRegex =
      /(?:\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+?\$|\\\([\s\S]+?\\\)|\\begin\{cases\}[\s\S]+?\\end\{cases\})/g;
    let rebuilt = "";
    let ptr = 0;
    let tm: RegExpExecArray | null;
    while ((tm = tokenRegex.exec(cleanSegment)) !== null) {
      if (tm.index > ptr) {
        rebuilt += autoWrapUnwrappedMathForEquation(cleanSegment.slice(ptr, tm.index));
      }
      rebuilt += tm[0];
      ptr = tokenRegex.lastIndex;
    }
    if (ptr < cleanSegment.length) {
      rebuilt += autoWrapUnwrappedMathForEquation(cleanSegment.slice(ptr));
    }
    cleanSegment = rebuilt;
  }

  const pushPlainTextWithBold = (rawTxt: string) => {
    if (!rawTxt) return;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let bLast = 0;
    let bMatch: RegExpExecArray | null;

    const formatStr = (s: string) => (mathFormat === "latex" ? s : latexToUnicode(s));

    while ((bMatch = boldRegex.exec(rawTxt)) !== null) {
      const normalText = rawTxt.substring(bLast, bMatch.index);
      if (normalText) {
        runs.push(
          new TextRun({
            text: formatStr(normalText),
            font: fontName,
            size: fontSize,
            bold: isRed ? false : isDefaultBold,
            color: isRed ? RED_COLOR : "000000",
          })
        );
      }
      const boldText = bMatch[1];
      if (boldText) {
        runs.push(
          new TextRun({
            text: formatStr(boldText),
            font: fontName,
            size: fontSize,
            bold: isRed ? false : true,
            color: isRed ? RED_COLOR : "000000",
          })
        );
      }
      bLast = boldRegex.lastIndex;
    }

    const remainder = rawTxt.substring(bLast);
    if (remainder) {
      runs.push(
        new TextRun({
          text: formatStr(remainder),
          font: fontName,
          size: fontSize,
          bold: isRed ? false : isDefaultBold,
          color: isRed ? RED_COLOR : "000000",
        })
      );
    }
  };

  if (mathFormat === "latex") {
    // RAW LATEX MODE: keep $$...$$ and $...$ verbatim in single unbroken TextRun with exact document font
    const rawLatexRegex = /(\$\$[^$\n]+?\$\$|\$[^$\n]+?\$)/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = rawLatexRegex.exec(cleanSegment)) !== null) {
      const textBefore = cleanSegment.substring(lastIdx, match.index);
      if (textBefore) {
        pushPlainTextWithBold(textBefore);
      }
      const verbatimMath = match[1];
      runs.push(
        new TextRun({
          text: verbatimMath,
          font: fontName,
          size: fontSize,
          bold: isRed ? false : isDefaultBold,
          color: isRed ? RED_COLOR : "000000",
        })
      );
      lastIdx = rawLatexRegex.lastIndex;
    }

    const textAfter = cleanSegment.substring(lastIdx);
    if (textAfter) {
      pushPlainTextWithBold(textAfter);
    }
    return;
  }

  // EQUATION (OMML) MODE: convert 100% of math tokens into native Word OMML <m:oMath>
  const mathRegex =
    /(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|(\\begin\{cases\}[\s\S]+?\\end\{cases\}))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(cleanSegment)) !== null) {
    const textBefore = cleanSegment.substring(lastIdx, match.index);
    if (textBefore) {
      pushPlainTextWithBold(textBefore);
    }

    const formula = match[1] || match[2] || match[3] || match[4] || match[5];
    if (formula) {
      runs.push(convertLatexToDocxMath(formula, isRed));
    }

    lastIdx = mathRegex.lastIndex;
  }

  const textAfter = cleanSegment.substring(lastIdx);
  if (textAfter) {
    pushPlainTextWithBold(textAfter);
  }
}

/**
 * Inspects and verifies the actual XML structure inside the generated .docx archive
 * before delivering it to the user, ensuring truthful 100% Equation or Raw LaTeX compliance.
 */
export async function verifyGeneratedDocxXml(
  docxBytesOrBlob: Uint8Array | Blob | ArrayBuffer,
  mathFormat: MathOutputFormat
): Promise<DocxVerificationReport> {
  const issues: string[] = [];
  const zip = await JSZip.loadAsync(docxBytesOrBlob as any);
  const docXml = (await zip.file("word/document.xml")?.async("string")) || "";

  const xmlValid =
    docXml.includes("<w:document") &&
    docXml.includes("<w:body>") &&
    docXml.includes("</w:body>") &&
    docXml.includes("</w:document>");

  if (!xmlValid) {
    issues.push("Cấu trúc word/document.xml thiếu thẻ đóng/mở chuẩn OpenXML.");
  }

  const ommlEquationCount = (docXml.match(/<m:oMath\b/g) || []).length;
  const tableCount = (docXml.match(/<w:tbl\b/g) || []).length;
  const embeddedImageCount = (docXml.match(/<a:blip\b/g) || []).length;
  const mediaFileCount = Object.keys(zip.files).filter((f) => f.startsWith("word/media/")).length;
  const redRunCount = (docXml.match(/w:val="DC2626"/gi) || []).length;

  const hasHeader = Object.keys(zip.files).some((f) => /^word\/header\d*\.xml$/i.test(f));
  const hasFooter = Object.keys(zip.files).some((f) => /^word\/footer\d*\.xml$/i.test(f));
  const pageNumberMode = hasFooter ? "footer" : hasHeader ? "header" : "none";

  // Strip <m:oMath>...</m:oMath> blocks to inspect pure <w:t> plain text runs
  const xmlWithoutOmml = docXml.replace(/<m:oMath\b[\s\S]*?<\/m:oMath>/g, "");
  const plainTextRuns = (xmlWithoutOmml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || []).map((t) =>
    t
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
  );
  const combinedPlainText = plainTextRuns.join(" ");

  const rawDisplayMatches = combinedPlainText.match(/\$\$[^$]+\$\$/g) || [];
  const textWithoutDisplay = combinedPlainText.replace(/\$\$[^$]+\$\$/g, " ");
  const rawInlineMatches = textWithoutDisplay.match(/\$[^$]+\$/g) || [];

  let leakedRawLatexInEquationMode = 0;
  let forbiddenUnicodeInLatexMode = 0;

  if (mathFormat === "equation") {
    const leakedCmds =
      combinedPlainText.match(
        /\\(?:frac|dfrac|sqrt|begin\{cases\}|end\{cases\}|le\b|ge\b|neq\b|mathbb|overrightarrow|widehat)/g
      ) || [];
    leakedRawLatexInEquationMode =
      leakedCmds.length + rawDisplayMatches.length + rawInlineMatches.length;
    if (leakedRawLatexInEquationMode > 0) {
      issues.push(
        `Phát hiện ${leakedRawLatexInEquationMode} biểu thức LaTeX thô chưa chuyển sang đối tượng OMML.`
      );
    }
  } else {
    // mathFormat === 'latex'
    if (ommlEquationCount > 0) {
      issues.push(
        `Chế độ LaTeX thô yêu cầu 0 OMML nhưng phát hiện ${ommlEquationCount} thẻ <m:oMath>.`
      );
    }
    const globalForbidden = new RegExp(FORBIDDEN_UNICODE_MATH_REGEX.source, "g");
    const unicodeMatches = combinedPlainText.match(globalForbidden) || [];
    forbiddenUnicodeInLatexMode = unicodeMatches.length;
    if (forbiddenUnicodeInLatexMode > 0) {
      issues.push(
        `Phát hiện ${forbiddenUnicodeInLatexMode} ký tự Unicode toán học (${Array.from(
          new Set(unicodeMatches)
        )
          .slice(0, 5)
          .join(", ")}) trong chế độ mã LaTeX thô.`
      );
    }
  }

  const passed = xmlValid && issues.length === 0;
  const summary =
    mathFormat === "equation"
      ? `Đã kiểm tra XML DOCX (Chế độ Equation OMML): ${ommlEquationCount} đối tượng Equation <m:oMath> chỉnh sửa được trong Word, ${leakedRawLatexInEquationMode} lỗi rò rỉ LaTeX, ${embeddedImageCount} hình vẽ minh họa, ${tableCount} bảng biểu.`
      : `Đã kiểm tra XML DOCX (Chế độ LaTeX thô): ${
          rawInlineMatches.length + rawDisplayMatches.length
        } công thức LaTeX thô ($...$: ${rawInlineMatches.length}, $$...$$: ${
          rawDisplayMatches.length
        }), 0 OMML, ${forbiddenUnicodeInLatexMode} ký tự Unicode toán, ${embeddedImageCount} hình vẽ minh họa, ${tableCount} bảng biểu.`;

  return {
    passed,
    mathFormat,
    xmlValid,
    ommlEquationCount,
    rawInlineLatexCount: rawInlineMatches.length,
    rawDisplayLatexCount: rawDisplayMatches.length,
    leakedRawLatexInEquationMode,
    forbiddenUnicodeInLatexMode,
    embeddedImageCount,
    mediaFileCount,
    tableCount,
    redRunCount,
    pageNumberMode,
    issues,
    summary,
  };
}

/**
 * Core builder that produces the Word (.docx) binary + verified XML audit report
 * honoring 100% of user-selected FormattingOptions and mathFormat ('equation' | 'latex').
 */
export async function buildLessonPlanDocxBlob(
  rawContent: string,
  options: ParseOptions
): Promise<{
  blob: Blob;
  uint8Array: Uint8Array;
  verification: DocxVerificationReport;
  filename: string;
}> {
  const fontName = options.formatting?.fontName || DEFAULT_FONT_NAME;
  const fontSize = options.formatting?.fontSize || DEFAULT_BASE_FONT_SIZE; // 26 = 13pt
  const TITLE_FONT_SIZE = fontSize + 4; // e.g. 30 = 15pt
  const CAPTION_FONT_SIZE = Math.max(20, fontSize - 4); // e.g. 22 = 11pt
  const LINE_SPACING = options.formatting?.lineSpacing || 240;
  const PARA_SPACING =
    options.formatting?.paraSpacing !== undefined ? options.formatting.paraSpacing : 120;
  const CELL_PARA_SPACING = Math.max(40, Math.round(PARA_SPACING * 0.5));
  const MARGINS = options.formatting?.margins || {
    top: 850,
    bottom: 850,
    left: 1417,
    right: 850,
  };
  const PAGE_NUMBER = options.formatting?.pageNumber || "bottom-center";
  const MATH_FORMAT: MathOutputFormat = options.formatting?.mathFormat || "equation";

  // 1. Extract inline mathematical <svg>...</svg> drawings and data-URI images BEFORE line/table splitting,
  // normalizing every SVG to strict 1pt (#000000 black) stroke on white background
  const { contentWithTokens, visuals } = extractInlineVisuals(rawContent);

  // Pre-rasterize SVG fallbacks asynchronously
  const rasterizedFallbacks = new Map<string, Uint8Array>();
  for (const [id, vis] of visuals.entries()) {
    if (vis.kind === "svg" && vis.svg) {
      const pngBytes = await rasterizeSvgToPngBytes(vis.svg, vis.width, vis.height, 3);
      rasterizedFallbacks.set(id, pngBytes);
    }
  }

  // Helper to construct an ImageRun for an ExtractedVisual (gen_svg_x)
  const buildGeneratedVisualRun = (vis: ExtractedVisual, maxWidthPx: number): ImageRun => {
    const scale = vis.width > maxWidthPx ? maxWidthPx / vis.width : 1;
    const w = Math.round(vis.width * scale);
    const h = Math.round(vis.height * scale);

    if (vis.kind === "svg" && vis.svg) {
      const svgBytes =
        typeof Buffer !== "undefined"
          ? new Uint8Array(Buffer.from(vis.svg, "utf-8"))
          : new TextEncoder().encode(vis.svg);
      const fallbackPng = rasterizedFallbacks.get(vis.id) || base64ToBytes(vis.base64Data);
      return new ImageRun({
        type: "svg",
        data: svgBytes,
        fallback: {
          type: "png",
          data: fallbackPng,
        },
        transformation: { width: w, height: h },
      });
    }

    const imgBytes = base64ToBytes(vis.base64Data);
    return new ImageRun({
      type: vis.mimeType.includes("png") ? "png" : "jpg",
      data: imgBytes,
      transformation: { width: w, height: h },
    });
  };

  // 2. Preprocess markdown, collapse multi-line math, apply mode normalizer, normalize [[RED:...]]
  const preprocessed = preprocessLessonPlanContent(contentWithTokens, MATH_FORMAT);
  const lines = preprocessed.split("\n");
  const paragraphs: (Paragraph | Table)[] = [];

  // Check if content already contains school banner
  const first600 = preprocessed.slice(0, 600).toUpperCase();
  const hasExistingHeader =
    first600.includes("SỞ GIÁO DỤC") ||
    first600.includes("PHÒNG GD") ||
    first600.includes("TRƯỜNG:") ||
    first600.includes("TRƯỜNG TH") ||
    first600.includes("UBND");

  if (!hasExistingHeader) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: PARA_SPACING, line: LINE_SPACING },
        children: [
          new TextRun({
            text: "SỞ GIÁO DỤC VÀ ĐÀO TẠO ..... - TRƯỜNG: .....................................",
            font: fontName,
            size: fontSize,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: Math.max(PARA_SPACING, 180), line: LINE_SPACING },
        children: [
          new TextRun({
            text: "TỔ CHUYÊN MÔN: ................................ - GIÁO VIÊN: ................................",
            font: fontName,
            size: fontSize,
            italics: true,
          }),
        ],
      })
    );
  }

  let i = 0;
  let inTable = false;
  let tableRowsData: string[][] = [];

  const cellBorderDef = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  };

  /**
   * Appends text/math paragraphs into a TableCell, automatically centering standalone $$...$$ blocks
   */
  const pushCellTextLines = (
    target: Paragraph[],
    rawSubText: string,
    isHeaderRow: boolean
  ) => {
    const pieces =
      /\$\$[^$\n]+?\$\$/.test(rawSubText) && !/^\$\$[^$\n]+?\$\$$/.test(rawSubText.trim())
        ? rawSubText.split(/(\$\$[^$\n]+?\$\$)/g)
        : [rawSubText];

    for (const piece of pieces) {
      const p = piece.trim();
      if (!p) continue;

      if (/^(\$\$[\s\S]+\$\$|\\\[[\s\S]+\\\])$/.test(p)) {
        target.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40, line: LINE_SPACING },
            children: parseInlineRuns(p, false, fontName, fontSize, MATH_FORMAT),
          })
        );
        continue;
      }

      const unwrappedBullet = p.replace(/^\[\[RED:\s*/i, "");
      const bulletMatch = unwrappedBullet.match(/^([-–*+•])\s+(.*)$/);
      if (bulletMatch) {
        const isRedWrap = /^(\[\[RED:)/i.test(p);
        const body = isRedWrap ? `[[RED:${bulletMatch[2]}` : bulletMatch[2];
        target.push(
          new Paragraph({
            spacing: { after: CELL_PARA_SPACING, line: LINE_SPACING },
            alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
            indent: { left: 200 },
            children: [
              new TextRun({
                text: "–  ",
                font: fontName,
                size: fontSize,
                bold: false,
                color: isRedWrap ? RED_COLOR : "000000",
              }),
              ...parseInlineRuns(body, isHeaderRow, fontName, fontSize, MATH_FORMAT),
            ],
          })
        );
      } else {
        target.push(
          new Paragraph({
            spacing: { after: CELL_PARA_SPACING, line: LINE_SPACING },
            alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: parseInlineRuns(p, isHeaderRow, fontName, fontSize, MATH_FORMAT),
          })
        );
      }
    }
  };

  const flushTable = () => {
    if (tableRowsData.length === 0) return;
    const colCount = Math.max(...tableRowsData.map((r) => r.length));
    const totalTableWidth = PAGE_WIDTH_DXA - MARGINS.left - MARGINS.right;
    const colWidth = Math.floor(totalTableWidth / (colCount || 1));
    const maxCellImgPx = Math.min(Math.max(Math.round(colWidth * 0.052), 190), 270);

    const rows = tableRowsData.map((rowCells, rowIdx) => {
      const isHeaderRow = rowIdx === 0;
      const paddedCells = [...rowCells];
      while (paddedCells.length < colCount) paddedCells.push("");

      return new TableRow({
        children: paddedCells.map((cellText) => {
          const cellParagraphs: Paragraph[] = [];
          const subLines = cellText.split(/<br\s*\/?>/i);

          subLines.forEach((sub) => {
            let trimmedSub = sub
              .trim()
              .replace(/^&lt;br\s*\/?&gt;\s*[-–]?\s*/i, "")
              .replace(/^<br\s*\/?>\s*[-–]?\s*/i, "")
              .replace(/&lt;br\s*\/?&gt;/gi, "")
              .replace(/<br\s*\/?>/gi, "")
              .trim();

            if (!trimmedSub) return;

            // Split subline around any [[GEN_SVG:...]] or [[IMAGE:...]] tokens so text AND multiple figures in one cell both render cleanly!
            const visualTokenRegex = /(\[\[(?:GEN_SVG|IMAGE):[^:\]]+(?::[^\]]*)?\]\])/g;
            const tokens = trimmedSub.split(visualTokenRegex);

            for (const tok of tokens) {
              const t = tok.trim();
              if (!t) continue;

              const genMatch = t.match(/^\[\[GEN_SVG:([^:\]]+)(?::([\s\S]*?))?\]\]$/);
              if (genMatch) {
                const visId = genMatch[1];
                const caption = (genMatch[2] || "").trim();
                const visObj = visuals.get(visId);
                if (visObj) {
                  try {
                    const imgRun = buildGeneratedVisualRun(visObj, maxCellImgPx);
                    cellParagraphs.push(
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 80, after: 40, line: LINE_SPACING },
                        children: [imgRun],
                      })
                    );
                    const finalCap = caption || visObj.caption;
                    if (finalCap) {
                      cellParagraphs.push(
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 60, line: LINE_SPACING },
                          children: parseInlineRuns(
                            finalCap,
                            false,
                            fontName,
                            CAPTION_FONT_SIZE,
                            MATH_FORMAT
                          ),
                        })
                      );
                    }
                  } catch (e) {
                    console.error("Cell generated SVG embedding error:", e);
                  }
                }
                continue;
              }

              const imageMatch = t.match(/^\[\[IMAGE:([^:\]]+)(?::([\s\S]*?))?\]\]$/);
              if (imageMatch) {
                const imgId = imageMatch[1];
                const caption = (imageMatch[2] || "").trim();
                const imgObj = findImage(imgId, options.images);
                if (imgObj) {
                  try {
                    const imgData = base64ToBytes(imgObj.data);
                    cellParagraphs.push(
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 60, after: 40, line: LINE_SPACING },
                        children: [
                          new ImageRun({
                            data: imgData,
                            transformation: { width: maxCellImgPx, height: Math.round(maxCellImgPx * 0.68) },
                            type: imgObj.mimeType?.includes("png") ? "png" : "jpg",
                          }),
                        ],
                      })
                    );
                    if (caption) {
                      cellParagraphs.push(
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 60, line: LINE_SPACING },
                          children: [
                            new TextRun({
                              text: caption,
                              font: fontName,
                              size: CAPTION_FONT_SIZE,
                              italics: true,
                              color: "334155",
                            }),
                          ],
                        })
                      );
                    }
                  } catch (e) {
                    console.error("Cell image embedding error:", e);
                  }
                } else if (caption) {
                  cellParagraphs.push(
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 60, after: 60, line: LINE_SPACING },
                      children: parseInlineRuns(caption, false, fontName, CAPTION_FONT_SIZE, MATH_FORMAT),
                    })
                  );
                }
                continue;
              }

              pushCellTextLines(cellParagraphs, t, isHeaderRow);
            }
          });

          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            shading: isHeaderRow ? { fill: "F1F5F9" } : undefined,
            borders: cellBorderDef,
            margins: {
              top: 110,
              bottom: 110,
              left: 140,
              right: 140,
            },
            children:
              cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [] })],
          });
        }),
      });
    });

    paragraphs.push(
      new Table({
        width: { size: totalTableWidth, type: WidthType.DXA },
        rows,
      })
    );
    paragraphs.push(
      new Paragraph({ spacing: { after: PARA_SPACING, line: LINE_SPACING }, children: [] })
    );
    tableRowsData = [];
    inTable = false;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const cleaned = cleanLineFormatting(rawLine);
    const trimmed = cleaned.trim();

    // 1. Standalone generated mathematical SVG/figure tag: [[GEN_SVG:gen_svg_1:Hình 2.5...]]
    const genSvgMatch = trimmed.match(/^\[\[GEN_SVG:([^:\]]+)(?::([\s\S]*?))?\]\]$/);
    if (genSvgMatch) {
      if (inTable) flushTable();
      const visId = genSvgMatch[1];
      const caption = (genSvgMatch[2] || "").trim();
      const visObj = visuals.get(visId);

      if (visObj) {
        try {
          const imgRun = buildGeneratedVisualRun(visObj, 380);
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 60, line: LINE_SPACING },
              children: [imgRun],
            })
          );
          const finalCap = caption || visObj.caption;
          if (finalCap) {
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: PARA_SPACING, line: LINE_SPACING },
                children: parseInlineRuns(
                  finalCap,
                  false,
                  fontName,
                  CAPTION_FONT_SIZE,
                  MATH_FORMAT
                ),
              })
            );
          }
        } catch (e) {
          console.error("Standalone SVG figure embedding error:", e);
        }
      }
      i++;
      continue;
    }

    // 2. Standalone uploaded image tag: [[IMAGE:1:Hình 1...]]
    const imageTagMatch = trimmed.match(/^\[\[IMAGE:([^:\]]+)(?:\:([\s\S]*?))?\]\]$/);
    if (imageTagMatch) {
      if (inTable) flushTable();
      const imgId = imageTagMatch[1];
      const caption = (imageTagMatch[2] || "").trim();
      const imgObj = findImage(imgId, options.images);

      if (imgObj) {
        try {
          const imgData = base64ToBytes(imgObj.data);
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 160, after: 60, line: LINE_SPACING },
              children: [
                new ImageRun({
                  data: imgData,
                  transformation: { width: 400, height: 250 },
                  type: imgObj.mimeType?.includes("png") ? "png" : "jpg",
                }),
              ],
            })
          );
          if (caption) {
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: PARA_SPACING, line: LINE_SPACING },
                children: [
                  new TextRun({
                    text: caption,
                    font: fontName,
                    size: CAPTION_FONT_SIZE,
                    italics: true,
                    color: "475569",
                  }),
                ],
              })
            );
          }
        } catch (e) {
          console.error("Image embedding error:", e);
        }
      } else if (caption) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: PARA_SPACING, line: LINE_SPACING },
            children: parseInlineRuns(caption, false, fontName, fontSize, MATH_FORMAT),
          })
        );
      }
      i++;
      continue;
    }

    // 3. Markdown Table Row: starts and ends with |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        i++;
        continue;
      }
      inTable = true;
      const cells = splitMarkdownTableRow(trimmed).map((c) => cleanLineFormatting(c.trim(), true));
      tableRowsData.push(cells);
      i++;
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) {
      i++;
      continue;
    }

    // 4. Heading 1 / Lesson Title
    if (
      trimmed.startsWith("# ") ||
      trimmed.startsWith("KẾ HOẠCH BÀI DẠY") ||
      trimmed.startsWith("GIÁO ÁN") ||
      /^BÀI\s+\d+\s*[:.\-]/i.test(trimmed)
    ) {
      const headingText = trimmed.replace(/^#\s*/, "");
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            before: Math.max(PARA_SPACING, 160),
            after: PARA_SPACING,
            line: LINE_SPACING,
          },
          children: parseInlineRuns(headingText.toUpperCase(), true, fontName, TITLE_FONT_SIZE, MATH_FORMAT),
        })
      );
      i++;
      continue;
    }

    // 5. Main section roman numerals I., II., III., IV., V. or TIẾT 1, TIẾT 2...
    if (
      /^[IVXLCDM]+\.\s+/i.test(trimmed) ||
      /^TIẾT\s+\d+\b/i.test(trimmed) ||
      trimmed.startsWith("## ")
    ) {
      const secText = trimmed.replace(/^##\s*/, "");
      paragraphs.push(
        new Paragraph({
          spacing: {
            before: Math.max(PARA_SPACING, 160),
            after: PARA_SPACING,
            line: LINE_SPACING,
          },
          children: parseInlineRuns(secText, true, fontName, fontSize, MATH_FORMAT),
        })
      );
      i++;
      continue;
    }

    // 6. Subsection 1., 2., 3. or a., b., c., d. or a), b) or Hoạt động...
    if (
      /^(\d+\.|[a-d][.)])\s+/i.test(trimmed) ||
      /^HOẠT ĐỘNG\s+\d+/i.test(trimmed) ||
      /^Hoạt động\s+\d+/i.test(trimmed) ||
      /^Phân bố thời lượng/i.test(trimmed) ||
      trimmed.startsWith("### ")
    ) {
      const subText = trimmed.replace(/^###\s*/, "");
      // For "a. Mục tiêu: nội dung...", bold only the label if there's body text after ':'
      const labelColonMatch = subText.match(/^([a-d][.)]\s*[^:]{2,25}:)\s+([\s\S]+)$/i);
      if (labelColonMatch) {
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.BOTH,
            spacing: { before: 80, after: PARA_SPACING, line: LINE_SPACING },
            children: [
              ...parseInlineRuns(`${labelColonMatch[1]} `, true, fontName, fontSize, MATH_FORMAT),
              ...parseInlineRuns(labelColonMatch[2], false, fontName, fontSize, MATH_FORMAT),
            ],
          })
        );
      } else {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 100, after: Math.max(60, PARA_SPACING), line: LINE_SPACING },
            children: parseInlineRuns(subText, true, fontName, fontSize, MATH_FORMAT),
          })
        );
      }
      i++;
      continue;
    }

    // 7. Bullet points: '-', '–', '+', '*', '•' (with or without [[RED:...]] wrapper)
    const unwrappedForBullet = trimmed.replace(/^\[\[RED:\s*/i, "");
    const bulletMatch = unwrappedForBullet.match(/^([-–*+•])\s+(.*)$/);
    if (bulletMatch) {
      const isRedWrapped = /^\[\[RED:/i.test(trimmed);
      const bulletBody = bulletMatch[2];
      const runContent = isRedWrapped ? `[[RED:${bulletBody}` : bulletBody;
      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: PARA_SPACING, line: LINE_SPACING },
          children: [
            new TextRun({
              text: "–  ",
              font: fontName,
              size: fontSize,
              bold: false,
              color: isRedWrapped ? RED_COLOR : "000000",
            }),
            ...parseInlineRuns(runContent, false, fontName, fontSize, MATH_FORMAT),
          ],
        })
      );
      i++;
      continue;
    }

    // 8. Standalone display math equation ($$...$$ or \[...\]) - centered separate paragraph
    const unwrappedForMath = trimmed.replace(/^\[\[RED:\s*/i, "").replace(/\]\]\s*$/, "").trim();
    if (/^(\$\$[\s\S]+\$\$|\\\[[\s\S]+\\\])$/.test(unwrappedForMath)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            before: Math.max(80, PARA_SPACING),
            after: Math.max(80, PARA_SPACING),
            line: LINE_SPACING,
          },
          children: parseInlineRuns(trimmed, false, fontName, fontSize, MATH_FORMAT),
        })
      );
      i++;
      continue;
    }

    // 9. Regular paragraph (honoring fontName, fontSize, LINE_SPACING, PARA_SPACING)
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: PARA_SPACING, line: LINE_SPACING },
        indent: { firstLine: 400 },
        children: parseInlineRuns(trimmed, false, fontName, fontSize, MATH_FORMAT),
      })
    );

    i++;
  }

  if (inTable) {
    flushTable();
  }

  // Configure Header / Footer strictly matching user-selected PAGE_NUMBER option
  const buildPageNumberParagraph = (align: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({
      alignment: align,
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({
          children: [PageNumber.CURRENT],
          font: fontName,
          size: Math.max(22, fontSize - 2),
        }),
      ],
    });

  const sectionHeaders =
    PAGE_NUMBER === "top-center"
      ? { default: new Header({ children: [buildPageNumberParagraph(AlignmentType.CENTER)] }) }
      : undefined;

  const sectionFooters =
    PAGE_NUMBER === "bottom-center"
      ? { default: new Footer({ children: [buildPageNumberParagraph(AlignmentType.CENTER)] }) }
      : PAGE_NUMBER === "bottom-right"
      ? { default: new Footer({ children: [buildPageNumberParagraph(AlignmentType.RIGHT)] }) }
      : undefined;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_DXA,
              height: PAGE_HEIGHT_DXA,
            },
            margin: {
              top: MARGINS.top,
              bottom: MARGINS.bottom,
              left: MARGINS.left,
              right: MARGINS.right,
            },
          },
        },
        ...(sectionHeaders ? { headers: sectionHeaders } : {}),
        ...(sectionFooters ? { footers: sectionFooters } : {}),
        children: paragraphs,
      },
    ],
  });

  const uint8Buffer = await Packer.toBuffer(doc);
  const uint8Array = new Uint8Array(uint8Buffer);
  const blob = new Blob([uint8Array], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  // Verify actual XML structure of the generated DOCX before delivering
  const verification = await verifyGeneratedDocxXml(uint8Array, MATH_FORMAT);

  const cleanGrade = (options.grade || "").replace(/^Lớp\s*/i, "Lop_").replace(/\s+/g, "");
  const cleanSubject = (options.subject || "").replace(/\s+/g, "_");
  const cleanTitle = (options.lessonTitle || "BaiDay")
    .replace(/^BÀI\s*\d*[:\s.\-]*/i, "")
    .trim()
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const modeSuffix = MATH_FORMAT === "latex" ? "_LaTeX" : "_Equation";
  const filename = `GiaoAn_${cleanSubject}_${cleanGrade}_${cleanTitle}${modeSuffix}.docx`;

  return {
    blob,
    uint8Array,
    verification,
    filename,
  };
}

/**
 * Exports and triggers browser download of the verified Word (.docx) file,
 * returning the real XML verification report so the UI can display verified stats.
 */
export async function exportLessonPlanToDocx(
  rawContent: string,
  options: ParseOptions
): Promise<DocxVerificationReport> {
  const { blob, verification, filename } = await buildLessonPlanDocxBlob(rawContent, options);
  saveAs(blob, filename);
  return verification;
}
