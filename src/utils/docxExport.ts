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
  ImageRun,
  BorderStyle,
  Math as DocxMath,
} from "docx";
import { saveAs } from "file-saver";
import { latexToUnicode, convertLatexToDocxMath } from "./mathConverter";

// Constants for Page Setup (A4, standard Vietnamese educational guidelines)
// 1 cm = 567 twips (dxa)
const PAGE_WIDTH_DXA = 11906; // A4 210mm
const PAGE_HEIGHT_DXA = 16838; // A4 297mm

const DEFAULT_MARGIN_left = 1417; // 2.5 cm
const DEFAULT_MARGIN_right = 850; // 1.5 cm
const DEFAULT_MARGIN_top = 850; // 1.5 cm
const DEFAULT_MARGIN_bottom = 850; // 1.5 cm

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
  lineSpacing: number; // e.g. 240 for Single
  paraSpacing: number; // e.g. 120 for 6pt
  margins: { top: number; bottom: number; left: number; right: number }; // dxa
  pageNumber: 'none' | 'bottom-center' | 'bottom-right';
}

export interface ParseOptions {
  lessonTitle: string;
  subject: string;
  grade: string;
  images?: ImageAttachment[];
  formatting?: FormattingOptions;
}

/**
 * Converts a base64 data string into a Uint8Array for docx ImageRun
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/^data:image\/[a-z0-9\-+]+;base64,/, "");
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sanitizes line formatting:
 * - Removes '*' or '.' in front of headings
 * - Removes '*' at the end of sentences
 * - Removes any raw <br> tags
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
    // Inside table cell: preserve <br> but normalize <br>- or <br>–
    l = l.replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "<br>– ");
    l = l.replace(/<br\s*\/?>\s*[-–]\s*/gi, "<br>– ");
    l = l.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  }

  // 2. Remove leading '.' or '*' or '*.' before roman numerals, numbers, headings, or activity titles
  l = l.replace(/^[\s*.]+(?=[I|V|XLCDM]+\b[\.\:\s])/i, "");
  l = l.replace(/^[\s*.]+(?=\d+[\.\)\:\s])/i, "");
  l = l.replace(/^[\s*.]+(?=[a-z]\)[\s])/i, "");
  l = l.replace(/^[\s*.]+(?=(?:Hoạt động|HOẠT ĐỘNG|MỤC TIÊU|Mục tiêu|TIẾN TRÌNH|Tiến trình|THIẾT BỊ|Thiết bị|HỒ SƠ|Hồ sơ)[\s\:\.])/i, "");

  // 3. Remove markdown asterisks wrapper around headings
  l = l.replace(/^\*\*(.*?)\*\*$/, "$1");
  l = l.replace(/^[\s*.]+\*\*(.*?)\*\*/, "$1");

  // 4. Remove trailing '*' at the end of sentences or lines
  l = l.replace(/\*+\s*([.,;:!?])/g, "$1");
  l = l.replace(/([.,;:!?])\*+\s*$/g, "$1");
  l = l.replace(/\*+\s*$/g, "");

  // 5. Clean inside [[RED:...]] tags to avoid extra asterisks, normalize casing
  l = l.replace(/\[\[\s*red\s*:/gi, "[[RED:");
  l = l.replace(/\[\[RED:\s*\*\*(.*?)\*\*\s*\]\]/gi, "[[RED:$1]]");
  l = l.replace(/\[\[RED:\s*\*(.*?)\*\s*\]\]/gi, "[[RED:$1]]");
  l = l.replace(/\[\[RED:(.*?)\*+\]\]/gi, "[[RED:$1]]");

  // 6. Fix arbitrary Title Case capitalization on common headings, steps, and pedagogical terms
  l = l.replace(/\bMục\s+Tiêu\b/gi, "Mục tiêu");
  l = l.replace(/\bNội\s+Dung\b/gi, "Nội dung");
  l = l.replace(/\bSản\s+Phẩm\b/gi, "Sản phẩm");
  l = l.replace(/\bTổ\s+Chức\s+Thực\s+Hiện\b/gi, "Tổ chức thực hiện");
  l = l.replace(/\bVề\s+Kiến\s+Thức\b/gi, "Về kiến thức");
  l = l.replace(/\bVề\s+Năng\s+Lực\b/gi, "Về năng lực");
  l = l.replace(/\bVề\s+Phẩm\s+Chất\b/gi, "Về phẩm chất");
  l = l.replace(/\bĐối\s+Với\s+Giáo\s+Viên\b/gi, "Đối với giáo viên");
  l = l.replace(/\bĐối\s+Với\s+Học\s+Sinh\b/gi, "Đối với học sinh");
  l = l.replace(/\bChuyển\s+Giao\s+Nhiệm\s+Vụ\b/gi, "Chuyển giao nhiệm vụ");
  l = l.replace(/\bThực\s+Hiện\s+Nhiệm\s+Vụ\b/gi, "Thực hiện nhiệm vụ");
  l = l.replace(/\bBáo\s+Cáo\s+Kết\s+Quả\b/gi, "Báo cáo kết quả");
  l = l.replace(/\bĐánh\s+Giá\s+Kết\s+Quả\b/gi, "Đánh giá kết quả");
  l = l.replace(/\bSản\s+Phẩm\s+Dự\s+Kiến\b/gi, "Sản phẩm dự kiến");
  l = l.replace(/\bHoạt\s+Động\s+Của\s+GV\s+Và\s+HS\b/gi, "Hoạt động của GV và HS");
  l = l.replace(/\bTrình\s+Tự\s+Đọc\b/gi, "Trình tự đọc");
  l = l.replace(/\bNội\s+Dung\s+Cần\s+Hiểu\b/gi, "Nội dung cần hiểu");
  l = l.replace(/\bBảng\s+Đáp\s+Án\s+Trắc\s+Nhiệm\b/gi, "Bảng đáp án trắc nghiệm");
  l = l.replace(/\bHệ\s+Thống\s+Câu\s+Hỏi\s+Trắc\s+Nhiệm\b/gi, "Hệ thống câu hỏi trắc nghiệm");
  l = l.replace(/\bPhiếu\s+Học\s+Tập\b/gi, "Phiếu học tập");
  l = l.replace(/\bHoạt\s+Động\s+Khởi\s+Động\b/gi, "Hoạt động khởi động");
  l = l.replace(/\bHình\s+Thành\s+Kiến\s+Thức\s+Mới\b/gi, "Hình thành kiến thức mới");
  l = l.replace(/\bHoạt\s+Động\s+Luyện\s+Tập\b/gi, "Hoạt động luyện tập");
  l = l.replace(/\bHoạt\s+Động\s+Vận\s+Dụng\b/gi, "Hoạt động vận dụng");
  l = l.replace(/\bKhung\s+Tên\b/g, "Khung tên");
  l = l.replace(/\bBảng\s+Kê\b/g, "Bảng kê");
  l = l.replace(/\bHình\s+Biểu\s+Diễn\b/g, "Hình biểu diễn");
  l = l.replace(/\bKích\s+Thước\b/g, "Kích thước");
  l = l.replace(/\bTổng\s+Hợp\b/g, "Tổng hợp");
  l = l.replace(/\bYêu\s+Cầu\s+Cần\s+Đạt\b/gi, "Yêu cầu cần đạt");
  l = l.replace(/\bThiết\s+Bị\s+Dạy\s+Học\b/gi, "Thiết bị dạy học");
  l = l.replace(/\bHọc\s+Liệu\s+Số\b/gi, "Học liệu số");
  l = l.replace(/\bNăng\s+Lực\s+Số\b/g, "Năng lực số");
  l = l.replace(/\bNăng\s+Lực\s+Chung\b/gi, "Năng lực chung");
  l = l.replace(/\bNăng\s+Lực\s+Công\s+Nghệ\b/gi, "Năng lực công nghệ");
  l = l.replace(/\bNăng\s+Lực\s+Đặc\s+Thù\b/gi, "Năng lực đặc thù");
  l = l.replace(/\bTự\s+Chủ\s+Và\s+Tự\s+Học\b/gi, "Tự chủ và tự học");
  l = l.replace(/\bGiao\s+Tiếp\s+Và\s+Hợp\s+Tác\b/gi, "Giao tiếp và hợp tác");
  l = l.replace(/\bGiải\s+Quyết\s+Vấn\s+Đề\s+Và\s+Sáng\s+Tạo\b/gi, "Giải quyết vấn đề và sáng tạo");
  l = l.replace(/\bHướng\s+Dẫn\s+Tự\s+Học\b/gi, "Hướng dẫn tự học");
  l = l.replace(/\bBản\s+Vẽ\s+Chi\s+Tiết\b/g, "Bản vẽ chi tiết");
  l = l.replace(/\bBản\s+Vẽ\s+Lắp\b/g, "Bản vẽ lắp");
  l = l.replace(/\bBản\s+Vẽ\s+Kĩ\s+Thuật\b/g, "Bản vẽ kĩ thuật");
  l = l.replace(/\bBản\s+Vẽ\s+Nhà\b/g, "Bản vẽ nhà");

  return l;
}

/**
 * Normalizes [[RED:...]] tags so they don't get broken across multiple lines or <br> breaks.
 * If [[RED:...]] encloses multiple lines, each line is individually wrapped in [[RED:...]].
 */
export function normalizeRedTags(content: string): string {
  if (!content) return "";

  // Normalize case-insensitivity and spacing for RED tags
  let text = content.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  // 1. Wrap each line within multi-line [[RED:...]] blocks individually
  let normalized = text.replace(/\[\[RED:([\s\S]*?)\]\]/gi, (_, inner) => {
    const lines = inner.split('\n');
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
            .join('');
        }
        const cleanLine = line.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "").trim();
        return cleanLine ? `[[RED:${cleanLine}]]` : "";
      })
      .join('\n');
  });

  // 2. Auto-close any unclosed [[RED:... line by line
  const lines = normalized.split('\n');
  const fixedLines = lines.map(line => {
    let l = line;
    const opens = (l.match(/\[\[RED:/g) || []).length;
    const closes = (l.match(/\]\]/g) || []).length;
    if (opens > closes) {
      l += "]]".repeat(opens - closes);
    }
    return l;
  });

  return fixedLines.join('\n');
}

/**
 * Preprocesses markdown text:
 * 1. Normalizes multi-line [[RED:...]] tags.
 * 2. Converts <br> tags outside of tables into actual newlines (\n) and cleans any <br>- artifacts.
 */
export function preprocessLessonPlanContent(content: string): string {
  if (!content) return "";

  const withNormalizedRed = normalizeRedTags(content);
  const lines = withNormalizedRed.split("\n");
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Inside table row: keep <br> for cell splitting, normalize <br>- to <br>–
      const cleanTableRow = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "<br>– ")
        .replace(/<br\s*\/?>\s*[-–]\s*/gi, "<br>– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
      processedLines.push(cleanTableRow);
    } else {
      // Outside table row: replace <br>- and <br> with actual newlines \n
      const cleaned = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "\n– ")
        .replace(/<br\s*\/?>\s*[-–]\s*/gi, "\n– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");

      if (cleaned.includes("\n")) {
        const parts = cleaned.split("\n");
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
 * Finds an image attachment by index (e.g. 1, 2) or by id/name
 */
function findImage(idOrIndex: string, images?: ImageAttachment[]): ImageAttachment | null {
  if (!images || images.length === 0) return null;
  const cleanKey = idOrIndex.trim().toLowerCase();

  // 1. Direct match by id
  const byId = images.find(img => img.id.toLowerCase() === cleanKey);
  if (byId) return byId;

  // 2. Numeric index match (e.g. 1 -> images[0])
  const num = parseInt(cleanKey, 10);
  if (!isNaN(num) && num > 0 && num <= images.length) {
    return images[num - 1];
  }

  // 3. Name match
  return images.find(img => img.name && (img.name.toLowerCase() === cleanKey || img.name.toLowerCase().includes(cleanKey))) || null;
}

/**
 * Parses markdown-like text with [[RED:...]] tags and math expressions into Word Runs (TextRun | Math).
 * Requirements:
 * - Red content is ONLY RED, NEVER BOLD (bold: false).
 * - Never leaves raw "[[RED:" or "]]" or "<br>-" in text.
 * - Converts math expressions ($...$, $$...$$, \(...\), \[...\]) into native Word Math or clean Unicode.
 */
function parseInlineRuns(text: string, defaultBold = false, fontName = DEFAULT_FONT_NAME, fontSize = DEFAULT_BASE_FONT_SIZE): (TextRun | DocxMath)[] {
  const runs: (TextRun | DocxMath)[] = [];

  // Clean up rogue [..] or [i] annotations and any leftover HTML breaks
  let sanitized = text
    .replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ")
    .replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ")
    .replace(/&lt;br\s*\/?&gt;/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/\[\.\.\.\]/g, "")
    .replace(/\[i\]/gi, "")
    .replace(/\[\d+\]/g, "");

  // Normalize case-insensitivity and spacing for [[RED:
  sanitized = sanitized.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  // If there are unclosed [[RED: in this line, ensure they get closed
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
      if (cleanPre) appendFormattedRuns(runs, cleanPre, false, defaultBold, fontName, fontSize);
    }
    const redContent = match[1];
    if (redContent) {
      const cleanRed = redContent.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "");
      if (cleanRed) appendFormattedRuns(runs, cleanRed, true, false, fontName, fontSize);
    }
    lastIndex = regex.lastIndex;
  }

  const remaining = sanitized.substring(lastIndex);
  if (remaining) {
    const cleanRem = remaining.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "");
    if (cleanRem) appendFormattedRuns(runs, cleanRem, false, defaultBold, fontName, fontSize);
  }

  return runs.length > 0
    ? runs
    : [
        new TextRun({
          text: latexToUnicode(sanitized.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "")),
          font: fontName,
          size: fontSize,
          bold: defaultBold,
        }),
      ];
}

/**
 * Helper to parse bold markdown **text** and math expressions inside regular or red segments.
 * When isRed is true, bold is strictly false as requested by the user.
 */
function appendFormattedRuns(runs: (TextRun | DocxMath)[], textSegment: string, isRed: boolean, isDefaultBold: boolean, fontName: string, fontSize: number) {
  const cleanSegment = textSegment
    .replace(/\[\[\s*RED:?/gi, "")
    .replace(/\]\]/g, "")
    .replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ")
    .replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ")
    .replace(/&lt;br\s*\/?&gt;/gi, "")
    .replace(/<br\s*\/?>/gi, "");

  if (!cleanSegment) return;

  // Math regex: $$...$$, \[...\], $...$, \(...\)
  const mathRegex = /(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  const pushTextSegment = (rawTxt: string) => {
    if (!rawTxt) return;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let bLast = 0;
    let bMatch: RegExpExecArray | null;

    while ((bMatch = boldRegex.exec(rawTxt)) !== null) {
      const normalText = rawTxt.substring(bLast, bMatch.index);
      if (normalText) {
        runs.push(new TextRun({
          text: latexToUnicode(normalText),
          font: fontName,
          size: fontSize,
          bold: isRed ? false : isDefaultBold,
          color: isRed ? RED_COLOR : "000000",
        }));
      }
      const boldText = bMatch[1];
      if (boldText) {
        runs.push(new TextRun({
          text: latexToUnicode(boldText),
          font: fontName,
          size: fontSize,
          bold: isRed ? false : true,
          color: isRed ? RED_COLOR : "000000",
        }));
      }
      bLast = boldRegex.lastIndex;
    }

    const remainder = rawTxt.substring(bLast);
    if (remainder) {
      runs.push(new TextRun({
        text: latexToUnicode(remainder),
        font: fontName,
        size: fontSize,
        bold: isRed ? false : isDefaultBold,
        color: isRed ? RED_COLOR : "000000",
      }));
    }
  };

  while ((match = mathRegex.exec(cleanSegment)) !== null) {
    const textBefore = cleanSegment.substring(lastIdx, match.index);
    if (textBefore) {
      pushTextSegment(textBefore);
    }

    const formula = match[1] || match[2] || match[3] || match[4];
    if (formula) {
      if (isRed) {
        // Red math formula: formatted cleanly as Unicode TextRun with red color
        runs.push(new TextRun({
          text: latexToUnicode(formula),
          font: fontName,
          size: fontSize,
          bold: false,
          color: RED_COLOR,
        }));
      } else {
        // Standard formula: convert to native Word Math (OMML)
        try {
          const docxMath = convertLatexToDocxMath(formula);
          runs.push(docxMath);
        } catch {
          runs.push(new TextRun({
            text: latexToUnicode(formula),
            font: fontName,
            size: fontSize,
            bold: isDefaultBold,
            color: "000000",
          }));
        }
      }
    }

    lastIdx = mathRegex.lastIndex;
  }

  const textAfter = cleanSegment.substring(lastIdx);
  if (textAfter) {
    pushTextSegment(textAfter);
  }
}

/**
 * Converts the generated lesson plan text into a structured Word (.docx) document
 * satisfying all formatting constraints:
 * - Preserves structure, layout, alignments, headings, line spacing of original lesson plan
 * - Preserves multi-column tables (e.g. 2 columns: Hoạt động GV-HS | Sản phẩm dự kiến)
 * - Embeds textbook images at the exact positions specified by [[IMAGE:...]]
 * - Digital competency additions are RED ONLY, NOT BOLD, NO INDICATOR CODES
 * - Header has ONLY centered page number (e.g. 1), NO 'Trang 1/1'
 */
export async function exportLessonPlanToDocx(rawContent: string, options: ParseOptions) {
  const fontName = options.formatting?.fontName || "Times New Roman";
  const fontSize = options.formatting?.fontSize || 26; // 13pt
  const TITLE_FONT_SIZE = fontSize + 4; // e.g. 30 for 15pt
  const LINE_SPACING = options.formatting?.lineSpacing || 240;
  const PARA_SPACING = options.formatting?.paraSpacing !== undefined ? options.formatting.paraSpacing : 120;
  const MARGINS = options.formatting?.margins || { top: 850, bottom: 850, left: 1417, right: 850 };
  const PAGE_NUMBER = options.formatting?.pageNumber || 'bottom-center';

  const preprocessed = preprocessLessonPlanContent(rawContent);
  const lines = preprocessed.split("\n");
  const paragraphs: (Paragraph | Table)[] = [];

  // Check if content already contains school banner
  const first500 = preprocessed.slice(0, 500).toUpperCase();
  const hasExistingHeader =
    first500.includes("SỞ GIÁO DỤC") ||
    first500.includes("PHÒNG GD") ||
    first500.includes("TRƯỜNG:") ||
    first500.includes("TRƯỜNG TH") ||
    first500.includes("UBND");

  // Only add standard educational top banner if user didn't have one in their original lesson plan
  if (!hasExistingHeader) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120, line: 240 },
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
        spacing: { after: 240, line: 240 },
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
    top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  };

  const flushTable = () => {
    if (tableRowsData.length === 0) return;
    const colCount = Math.max(...tableRowsData.map(r => r.length));
    const totalTableWidth = PAGE_WIDTH_DXA - MARGINS.left - MARGINS.right; // ~9639 dxa
    const colWidth = Math.floor(totalTableWidth / (colCount || 1));

    const rows = tableRowsData.map((rowCells, rowIdx) => {
      const isHeaderRow = rowIdx === 0;
      return new TableRow({
        children: rowCells.map(cellText => {
          const cellParagraphs: Paragraph[] = [];
          const subLines = cellText.split(/<br\s*\/?>/i);

          subLines.forEach(sub => {
            let trimmedSub = sub.trim();
            if (!trimmedSub) return;

            // Strip any remaining <br> or <br>- artifacts
            trimmedSub = trimmedSub
              .replace(/^&lt;br\s*\/?&gt;\s*[-–]?\s*/i, "")
              .replace(/^<br\s*\/?>\s*[-–]?\s*/i, "")
              .replace(/&lt;br\s*\/?&gt;/gi, "")
              .replace(/<br\s*\/?>/gi, "");

            if (!trimmedSub) return;

            const imageMatch = trimmedSub.match(/\[\[IMAGE:([^:\]]+)(?:\:([\s\S]*?))?\]\]/);

            if (imageMatch) {
              const imgId = imageMatch[1];
              const caption = imageMatch[2] || "";
              const imgObj = findImage(imgId, options.images);
              
              const textWithoutImage = trimmedSub.replace(imageMatch[0], "").trim();
              if (textWithoutImage) {
                cellParagraphs.push(
                  new Paragraph({
                    spacing: { after: 60, line: 240 },
                    alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
                    children: parseInlineRuns(textWithoutImage, isHeaderRow, fontName, fontSize),
                  })
                );
              }

              if (imgObj) {
                try {
                  const imgData = base64ToUint8Array(imgObj.data);
                  cellParagraphs.push(
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 60, after: 40 },
                      children: [
                        new ImageRun({
                          data: imgData,
                          transformation: { width: Math.min(colWidth * 0.045, 240), height: 150 },
                          type: imgObj.mimeType?.includes("png") ? "png" : "jpg",
                        }),
                      ],
                    })
                  );
                  if (caption) {
                    cellParagraphs.push(
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 60 },
                        children: [
                          new TextRun({ text: caption, font: fontName, size: 20, italics: true, color: "475569" }),
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
                    spacing: { before: 60, after: 60 },
                    children: [
                      new TextRun({
                        text: `[${caption}]`,
                        font: fontName,
                        size: fontSize,
                        italics: true,
                        bold: true,
                        color: "1E3A8A",
                      }),
                    ],
                  })
                );
              }
            } else {
              const isBullet = /^[-–*+]\s+/.test(trimmedSub);
              const cleanSub = isBullet ? trimmedSub.replace(/^[-–*+]\s+/, "") : trimmedSub;
              cellParagraphs.push(
                new Paragraph({
                  spacing: { after: 60, line: 240 },
                  alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
                  indent: isBullet ? { left: 240 } : undefined,
                  children: [
                    ...(isBullet ? [new TextRun({ text: "–  ", font: fontName, size: fontSize, bold: false })] : []),
                    ...parseInlineRuns(cleanSub, isHeaderRow, fontName, fontSize),
                  ],
                })
              );
            }
          });

          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            shading: isHeaderRow ? { fill: "F1F5F9" } : undefined,
            borders: cellBorderDef,
            margins: {
              top: 120,
              bottom: 120,
              left: 140,
              right: 140,
            },
            children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ children: [] })],
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
    paragraphs.push(new Paragraph({ spacing: { after: 120, line: 240 }, children: [] }));
    tableRowsData = [];
    inTable = false;
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const cleaned = cleanLineFormatting(rawLine);
    const trimmed = cleaned.trim();

    // Check if line is a standalone image tag: [[IMAGE:1:Hình 1. Thí nghiệm...]] or [[IMAGE:old_plan_img_1:...]]
    const imageTagMatch = trimmed.match(/^\[\[IMAGE:([^:\]]+)(?:\:([\s\S]*?))?\]\]$/);
    if (imageTagMatch) {
      if (inTable) flushTable();
      const imgId = imageTagMatch[1];
      const caption = imageTagMatch[2] || "";
      const imgObj = findImage(imgId, options.images);

      if (imgObj) {
        try {
          const imgData = base64ToUint8Array(imgObj.data);
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 160, after: 60 },
              children: [
                new ImageRun({
                  data: imgData,
                  transformation: { width: 440, height: 260 },
                  type: imgObj.mimeType?.includes("png") ? "png" : "jpg",
                }),
              ],
            })
          );
          if (caption) {
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 140, line: 240 },
                children: [
                  new TextRun({
                    text: caption,
                    font: fontName,
                    size: 22, // 11pt
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
            spacing: { before: 140, after: 140, line: 240 },
            children: [
              new TextRun({
                text: `[${caption}]`,
                font: fontName,
                size: fontSize,
                italics: true,
                bold: true,
                color: "1E3A8A",
              }),
            ],
          })
        );
      }
      i++;
      continue;
    }

    // Check if line is a table row: starts and ends with |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        i++;
        continue;
      }
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map(c => cleanLineFormatting(c.trim(), true));
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

    // Heading 1 / Lesson Title
    if (trimmed.startsWith("# ") || trimmed.startsWith("KẾ HOẠCH BÀI DẠY") || trimmed.startsWith("GIÁO ÁN")) {
      const headingText = trimmed.replace(/^#\s*/, "");
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 160, line: 240 },
          children: [
            new TextRun({
              text: headingText.toUpperCase(),
              font: fontName,
              size: TITLE_FONT_SIZE,
              bold: true,
              color: "1E293B",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // Main section roman numerals I., II., III., IV. (no leading '*' or '.')
    if (/^[I|V|XLCDM]+\.\s+/i.test(trimmed) || trimmed.startsWith("## ")) {
      const secText = trimmed.replace(/^##\s*/, "");
      paragraphs.push(
        new Paragraph({
          spacing: { before: 180, after: 120, line: 240 },
          children: parseInlineRuns(secText, true, fontName, fontSize),
        })
      );
      i++;
      continue;
    }

    // Subsection 1., 2., 3. or a), b), c) or Hoạt động... (no leading '*' or '.')
    if (/^(\d+\.|[a-z]\))\s+/i.test(trimmed) || /^Hoạt động\s+\d+/i.test(trimmed) || trimmed.startsWith("### ")) {
      const subText = trimmed.replace(/^###\s*/, "");
      paragraphs.push(
        new Paragraph({
          spacing: { before: 100, after: 80, line: 240 },
          children: parseInlineRuns(subText, true, fontName, fontSize),
        })
      );
      i++;
      continue;
    }

    // Bullet points: '-' or '–' or '+' or '*' (with or without [[RED:...]] wrapper)
    const unwrappedForBullet = trimmed.replace(/^\[\[RED:\s*/i, "");
    const bulletMatch = unwrappedForBullet.match(/^([-–*+])\s+(.*)$/);
    if (bulletMatch) {
      const isRedWrapped = trimmed.startsWith("[[RED:");
      const bulletBody = bulletMatch[2];
      const runContent = isRedWrapped ? `[[RED:${bulletBody}` : bulletBody;
      paragraphs.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { after: 120, line: 240 },
          children: [
            new TextRun({ text: "–  ", font: fontName, size: fontSize, bold: false }),
            ...parseInlineRuns(runContent, false, fontName, fontSize),
          ],
        })
      );
      i++;
      continue;
    }

    // Regular paragraph (standard 13pt Times New Roman, line spacing single / 240 dxa, justified)
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: 120, line: 240 },
        indent: { firstLine: 400 }, // Thụt lề đầu dòng chuẩn 0.7 cm
        children: parseInlineRuns(trimmed, false, fontName, fontSize),
      })
    );

    i++;
  }

  if (inTable) {
    flushTable();
  }

  // Create standard A4 document
  // Requirement: "số trang để ở giữa header chỉ ghi số trang không ghi định dạng kiểu 'Trang 1/1'"
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
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 120 },
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: fontName,
                    size: 24, // 12pt clean number
                  }),
                ],
              }),
            ],
          }),
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanGrade = (options.grade || '').replace(/^Lớp\s*/i, 'Lop_').replace(/\s+/g, '');
  const cleanSubject = (options.subject || '').replace(/\s+/g, '_');
  const cleanTitle = (options.lessonTitle || 'BaiDay')
    .replace(/^BÀI\s*\d*[:\s\.\-]*/i, '')
    .trim()
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeFilename = `GiaoAn_${cleanSubject}_${cleanGrade}_${cleanTitle}.docx`;
  saveAs(blob, safeFilename);
}
