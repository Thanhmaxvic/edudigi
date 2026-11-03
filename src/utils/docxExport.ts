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
  cleanPlainProseForWord,
  ensureMathAndTagSpacing,
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
import { DocxTemplateProfile, getImageDimensionsFromBytes } from "./fileExtractor";

// Constants for Page Setup (A4, standard Vietnamese educational guidelines)
// 1 cm = 567 twips (dxa)
const DEFAULT_PAGE_WIDTH_DXA = 11906; // A4 210mm
const DEFAULT_PAGE_HEIGHT_DXA = 16838; // A4 297mm

const DEFAULT_FONT_NAME = "Times New Roman";
const DEFAULT_BASE_FONT_SIZE = 26; // 13 pt (half-points: 13 * 2 = 26)
const RED_COLOR = "DC2626"; // Vibrant standard red for digital competency insertions

export interface ImageAttachment {
  id?: string;
  name?: string;
  data: string; // Base64 string
  mimeType?: string;
  width?: number;
  height?: number;
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
  templateProfile?: DocxTemplateProfile | null;
  preserveOriginalHeader?: boolean;
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
  leakedMarkdownSyntaxCount?: number;
  embeddedImageCount: number;
  mediaFileCount: number;
  tableCount: number;
  redRunCount: number;
  pageNumberMode: string;
  issues: string[];
  summary: string;
}

/**
 * Strips leading Markdown heading hashes (#, ##, ###, ####, #####, ######, #., ##.)
 * even if wrapped inside **...** or [[RED:...]].
 */
export function stripHeadingHashes(s: string): { level: number; text: string } {
  let working = s.trim();
  // Case 1: **### Title** -> ### **Title**
  const boldWrapHash = working.match(/^\*\*(#{1,6})\.?\s*([\s\S]*?)\*\*$/);
  if (boldWrapHash) {
    return {
      level: boldWrapHash[1].length,
      text: boldWrapHash[2].trim(),
    };
  }
  // Case 2: [[RED:### Title]] -> [[RED:Title]]
  const redWrapHash = working.match(/^\[\[RED:\s*(#{1,6})\.?\s*([\s\S]*)\]\]$/i);
  if (redWrapHash) {
    return {
      level: redWrapHash[1].length,
      text: `[[RED:${redWrapHash[2].trim()}]]`,
    };
  }
  // Case 3: Standard #, ##, ###, ####, #####, ###### (with or without space/dot)
  const hashMatch = working.match(/^(#{1,6})(?:\.(?=\s)|\s+|(?=[\p{L}\p{N}\[(]))\s*([\s\S]*)$/u);
  if (hashMatch) {
    return {
      level: hashMatch[1].length,
      text: hashMatch[2].trim(),
    };
  }
  return { level: 0, text: working };
}

/**
 * Sanitizes line formatting:
 * - Normalizes <br> tags without ever deleting spaces between words ("dính chữ")
 * - Removes stray '*', '#', '>' prefixes/suffixes
 * - Normalizes Vietnamese capitalization
 */
export function cleanLineFormatting(line: string, preserveBr = false): string {
  let l = line.replace(/\r/g, "").trimEnd();

  // 1. Normalize <br> tags (NEVER replace <br> with empty string "" which glues words!)
  if (!preserveBr) {
    l = l.replace(/&lt;br\s*\/?&gt;\s*[-–*+•]?\s*/gi, " ");
    l = l.replace(/<br\s*\/?>\s*[-–*+•]?\s*/gi, " ");
    l = l.replace(/&lt;br\s*\/?&gt;/gi, " ");
    l = l.replace(/<br\s*\/?>/gi, " ");
  } else {
    l = l.replace(/&lt;br\s*\/?&gt;\s*[-–*+•]\s+/gi, "<br>– ");
    l = l.replace(/<br\s*\/?>\s*[-–*+•]\s+/gi, "<br>– ");
    l = l.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    l = l.replace(/<br\s*\/?>/gi, "<br>");
  }

  // Strip Markdown blockquote prefix '> '
  if (!preserveBr) {
    l = l.replace(/^\s*>\s+/, "");
  }

  // 2. Remove leading '.' or '*' or '*.' before roman numerals, numbers, headings, or activity titles
  l = l.replace(/^[\s*.]+(?=[IVXLCDM]+\b[\.\:\s])/i, "");
  l = l.replace(/^[\s*.]+(?=\d+[\.\)\:\s])/i, "");
  l = l.replace(/^[\s*.]+(?=[a-z][\.\)]\s)/i, "");
  l = l.replace(
    /^[\s*.]+(?=(?:Hoạt động|HOẠT ĐỘNG|MỤC TIÊU|Mục tiêu|TIẾN TRÌNH|Tiến trình|THIẾT BỊ|Thiết bị|HỒ SƠ|Hồ sơ|PHỤ LỤC|Phụ lục|PHIẾU HỌC TẬP|Phiếu học tập|HƯỚNG DẪN|Hướng dẫn)[\s\:\.\d])/i,
    ""
  );

  // 3. Remove outer full-line **...** wrapper ONLY if there is no internal ** pair
  // (Careful: "**Bước 1:** nội dung **quan trọng**" has internal ** so must NOT strip outer!)
  const fullBoldMatch = l.match(/^\*\*([\s\S]+)\*\*$/);
  if (fullBoldMatch && !fullBoldMatch[1].includes("**")) {
    // Keep bold info on headings handled downstream, or unwrap cleanly if it's a pure heading line
    if (/^(?:#{1,6}\s*|[IVXLCDM]+\.\s+|\d+\.\s+|[a-d][.)]\s+|HOẠT ĐỘNG\b|Hoạt động\b|TIẾT\b|BÀI\b|KẾ HOẠCH\b|GIÁO ÁN\b|PHIẾU HỌC TẬP\b)/i.test(fullBoldMatch[1].trim())) {
      l = fullBoldMatch[1].trim();
    }
  }

  // 4. Remove stray trailing single '*' at end of sentence (without breaking balanced **bold** or *italic*)
  const asteriskCount = (l.match(/\*/g) || []).length;
  if (asteriskCount % 2 === 1 && /\*\s*$/.test(l) && !/\*\*\s*$/.test(l)) {
    l = l.replace(/\*\s*$/, "");
  }

  // 5. Clean inside [[RED:...]] tags
  l = l.replace(/\[\[\s*red\s*:/gi, "[[RED:");
  l = l.replace(/\[\[RED:\s*\*\*([\s\S]*?)\*\*\s*\]\]/gi, (_, b) =>
    b.includes("**") ? `[[RED:${b}]]` : `[[RED:${b}]]`
  );
  l = l.replace(/\[\[RED:\s*\*([^*]+)\*\s*\]\]/gi, "[[RED:$1]]");

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
 * Normalizes [[RED:...]] tags across newlines and <br> breaks while preserving outer spaces!
 */
export function normalizeRedTags(content: string): string {
  if (!content) return "";

  const text = content.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  const normalized = text.replace(/\[\[RED:([\s\S]*?)\]\]/gi, (_, inner: string) => {
    const leadSp = /^[ \t]+/.test(inner) ? " " : "";
    const trailSp = /[ \t]+$/.test(inner) ? " " : "";
    const lines = inner.split("\n");
    const body = lines
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
    return `${leadSp}${body}${trailSp}`;
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

  return ensureMathAndTagSpacing(fixedLines.join("\n"));
}

/**
 * Counts unescaped Markdown table pipe delimiters outside $...$ math expressions.
 */
function countTablePipesOutsideMath(line: string): number {
  let count = 0;
  let inMath = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "$" && line[i - 1] !== "\\") {
      if (line[i + 1] === "$") {
        inMath = !inMath;
        i++;
        continue;
      }
      inMath = !inMath;
      continue;
    }
    if (ch === "|" && line[i - 1] !== "\\" && !inMath) {
      count++;
    }
  }
  return count;
}

/**
 * Reconstructs Markdown table rows when AI or pasted content puts literal '\n' newlines
 * inside table cells instead of '<br>', preventing broken tables and preserving 100% of line breaks!
 */
function reconstructMultilineMarkdownTables(lines: string[]): string[] {
  const out: string[] = [];
  let expectedPipes = 0;
  let i = 0;

  const isMajorBreakHeading = (s: string) =>
    /^(?:#{1,4}\s*(?:[IVXLCDM]+\.|HOẠT ĐỘNG|Hoạt động|PHỤ LỤC|Phụ lục|PHIẾU HỌC TẬP|HƯỚNG DẪN)|[IVXLCDM]+\.\s+[A-ZÀ-Ỹ])/u.test(
      s
    );

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      expectedPipes = 0;
      out.push(raw);
      i++;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const pipes = countTablePipesOutsideMath(trimmed);

      // Separator row like | --- | --- | establishes expectedPipes accurately
      if (trimmed.endsWith("|") && /^\|[\s\-:|]+\|$/.test(trimmed)) {
        expectedPipes = pipes;
        out.push(trimmed);
        i++;
        continue;
      }

      // Header row followed immediately by separator row
      const nextTrimmed = (lines[i + 1] || "").trim();
      if (
        trimmed.endsWith("|") &&
        nextTrimmed.startsWith("|") &&
        /^\|[\s\-:|]+\|$/.test(nextTrimmed)
      ) {
        expectedPipes = countTablePipesOutsideMath(nextTrimmed);
        out.push(trimmed);
        i++;
        continue;
      }

      // Complete single-line row matching expected column pipes
      if (trimmed.endsWith("|") && (expectedPipes === 0 || pipes >= expectedPipes)) {
        if (expectedPipes === 0) expectedPipes = pipes;
        out.push(trimmed);
        i++;
        continue;
      }

      // Incomplete multi-line table row: accumulate continuation lines with <br> until pipes >= expectedPipes and endsWith("|")
      const targetPipes = expectedPipes > 0 ? expectedPipes : Math.max(2, pipes + 1);
      let acc = trimmed;
      let accPipes = pipes;
      let j = i + 1;
      let closed = false;

      while (j < lines.length && j - i < 60) {
        const cand = lines[j].trim();
        if (!cand) {
          j++;
          continue;
        }
        if (isMajorBreakHeading(cand) && !cand.startsWith("|")) {
          break;
        }
        // Join with <br> unless acc just opened a pipe '|'
        acc = acc.endsWith("|") ? `${acc} ${cand}` : `${acc}<br>${cand}`;
        accPipes = countTablePipesOutsideMath(acc);
        j++;
        if (acc.endsWith("|") && accPipes >= targetPipes) {
          closed = true;
          break;
        }
      }

      if (closed || acc.endsWith("|")) {
        out.push(acc);
        i = j;
        continue;
      }
    } else {
      expectedPipes = 0;
    }

    out.push(raw);
    i++;
  }

  return out;
}

/**
 * Splits structural steps & bullets that AI glued onto the same line (e.g. "...xong. **Bước 2: Thực hiện nhiệm vụ** - HS...")
 * while protecting $...$ math and [[...]] tags.
 */
function splitGluedStructuralSteps(line: string, breakToken: string): string {
  if (!line || line.trim().length < 20) return line;
  if (/^\|[\s\-:|]+\|$/.test(line.trim())) return line;

  // Protect math spans and [[...]] tokens
  const protectedSpans: string[] = [];
  let s = line.replace(
    /(\$\$[^$\n]+?\$\$|\$[^$\n]+?\$|\[\[(?:IMAGE|GEN_SVG):[^\]]*\]\])/g,
    (m) => {
      const idx = protectedSpans.length;
      protectedSpans.push(m);
      return `@@LPROT_${idx}@@`;
    }
  );

  // 1. Break before "**Bước 1..4:" or "Bước 1..4:" when preceded by non-pipe/non-break text
  s = s.replace(
    /([^\s|>])\s+((?:\[\[RED:\s*)?(?:\*{1,3})?Bước\s+[1-4]\s*[:.])/gi,
    `$1${breakToken}$2`
  );

  // 2. Outside tables, break glued "a) Mục tiêu:", "b) Nội dung:", "c) Sản phẩm:", "d) Tổ chức thực hiện:"
  if (breakToken === "\n") {
    s = s.replace(
      /([.!?;:])\s+((?:\*{1,3})?[a-d][.)]\s*(?:Mục tiêu|Nội dung|Sản phẩm|Tổ chức thực hiện)\s*:)/gi,
      `$1${breakToken}$2`
    );
  }

  // 3. Break glued bullets right after sentence punctuation (e.g. "...nhiệm vụ. - HS thực hiện..." or "...nhiệm vụ: + Nhóm 1...")
  s = s.replace(
    /([.!?]|\]\])\s+((?:\[\[RED:\s*)?[-–+•]\s+(?=(?:GV|HS|Học sinh|Giáo viên|Nhóm|Cá nhân|Đại diện|Các nhóm|Mỗi nhóm|Năng lực|Phẩm chất|\*\*)))/g,
    `$1${breakToken}$2`
  );

  s = s.replace(/@@LPROT_(\d+)@@/g, (_, idxStr) => protectedSpans[Number(idxStr)] ?? "");
  return s;
}

/**
 * Preprocesses markdown text (after inline SVGs have been tokenized):
 * 1. Normalizes all CRLF / HTML line-break entities & multi-line math blocks.
 * 2. Reconstructs multi-line Markdown table rows so intra-cell newlines become <br>.
 * 3. Normalizes [[RED:...]] tags and enforces word spacing around math & tags ("chống dính chữ").
 * 4. Splits glued structural steps/bullets onto proper paragraphs ("chống không ngắt dòng").
 */
export function preprocessLessonPlanContent(
  content: string,
  mathFormat: MathOutputFormat = "equation"
): string {
  if (!content) return "";

  const normalizedLineEndings = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/&#10;|&#x0?[aA];/g, "<br>")
    .replace(/<\/p>\s*<p[^>]*>/gi, "<br>")
    .replace(/<\/div>\s*<div[^>]*>/gi, "<br>");

  const withCollapsedMath = normalizedLineEndings
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

  // Reconstruct multi-line Markdown tables BEFORE splitting lines
  const tableReconstructedLines = reconstructMultilineMarkdownTables(
    withNormalizedMode.split("\n")
  );
  const withNormalizedRed = normalizeRedTags(tableReconstructedLines.join("\n"));

  const lines = withNormalizedRed.split("\n");
  const processedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip pure horizontal rules (***, ---, ___) so they never render literal '***' in Word!
    if (/^(?:\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      let cleanTableRow = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–*+•]\s+/gi, "<br>– ")
        .replace(/<br\s*\/?>\s*[-–*+•]\s+/gi, "<br>– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
        .replace(/<br\s*\/?>/gi, "<br>");
      cleanTableRow = splitGluedStructuralSteps(cleanTableRow, "<br>");
      processedLines.push(cleanTableRow);
    } else {
      let cleaned = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–*+•]\s+/gi, "\n– ")
        .replace(/<br\s*\/?>\s*[-–*+•]\s+/gi, "\n– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");

      cleaned = splitGluedStructuralSteps(cleaned, "\n");

      // In 'latex' mode, ensure any inline $$...$$ embedded inside a regular paragraph is split onto its own centered line
      const splitDisplayMath =
        mathFormat === "latex" &&
        /\$\$[\s\S]+?\$\$/.test(cleaned) &&
        !/^\$\$[\s\S]+\$\$$/.test(cleaned.trim())
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
        processedLines.push(splitDisplayMath);
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

  // Fallback for "hinh_1", "giao_an_cu_img_..._2" suffix index match
  const trailingIdxMatch = cleanKey.match(/(?:hinh|img|image)[_\-\s]*(\d+)$/i);
  if (trailingIdxMatch) {
    const idx = parseInt(trailingIdxMatch[1], 10);
    if (!isNaN(idx) && idx > 0 && idx <= images.length) {
      return images[idx - 1];
    }
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
 * Computes undistorted target (width, height) in pixels for an embedded image attachment.
 */
function resolveAttachmentDisplaySize(
  imgObj: ImageAttachment,
  imgBytes: Uint8Array,
  maxWidthPx: number,
  maxHeightPx: number
): { width: number; height: number } {
  const dims =
    imgObj.width && imgObj.height && imgObj.width > 0 && imgObj.height > 0
      ? { width: imgObj.width, height: imgObj.height }
      : getImageDimensionsFromBytes(imgBytes);

  if (!dims || dims.width <= 0 || dims.height <= 0) {
    return { width: maxWidthPx, height: Math.round(maxWidthPx * 0.68) };
  }

  let w = dims.width;
  let h = dims.height;

  // If natural image is very high-DPI (> maxWidthPx), scale down proportionally;
  // if very small icon/diagram, keep natural size without blurry upscaling.
  if (w > maxWidthPx) {
    const ratio = maxWidthPx / w;
    w = maxWidthPx;
    h = Math.round(h * ratio);
  }
  if (h > maxHeightPx) {
    const ratio = maxHeightPx / h;
    h = maxHeightPx;
    w = Math.round(w * ratio);
  }

  return {
    width: Math.max(24, Math.round(w)),
    height: Math.max(24, Math.round(h)),
  };
}

/**
 * Splits a Markdown table row `| cell1 | cell2 |` safely without splitting `|` inside `$...$` math (e.g. `|x|`) or escaped `\|`.
 */
export function splitMarkdownTableRow(rowLine: string): string[] {
  const inner = rowLine.trim().slice(1, -1);
  const cells: string[] = [];
  let cur = "";
  let inMath = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "\\" && inner[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (ch === "$" && inner[i - 1] !== "\\") {
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
 * Unified Stateful Inline Parser for Word Runs:
 * - Parses [[RED:...]], math ($...$, $$...$$, \(...\), \[...\], \begin{cases}...\end{cases}),
 *   ***bold-italic***, **bold**, *italic*, and `inline code` in ONE coordinated stream!
 * - Properly handles **bold text containing $math$ or [[RED:...]]** with ZERO leftover '*' or '**'!
 * - Preserves 100% of spaces between runs ("không dính chữ").
 * - Red digital competency runs are strictly RED (#DC2626) and NEVER bold.
 */
export function parseInlineRuns(
  text: string,
  defaultBold = false,
  fontName = DEFAULT_FONT_NAME,
  fontSize = DEFAULT_BASE_FONT_SIZE,
  mathFormat: MathOutputFormat = "equation"
): (TextRun | DocxMath | XmlComponent)[] {
  const runs: (TextRun | DocxMath | XmlComponent)[] = [];

  let sanitized = text
    .replace(/&lt;br\s*\/?&gt;\s*[-–*+•]?\s*/gi, " ")
    .replace(/<br\s*\/?>\s*[-–*+•]?\s*/gi, " ")
    .replace(/&lt;br\s*\/?&gt;/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[\.\.\.\]/g, "")
    .replace(/\[i\]/gi, "");

  sanitized = sanitized.replace(/\[\[\s*red\s*:/gi, "[[RED:");
  const opens = (sanitized.match(/\[\[RED:/g) || []).length;
  const closes = (sanitized.match(/\]\]/g) || []).length;
  if (opens > closes) {
    sanitized += "]]".repeat(opens - closes);
  }
  sanitized = ensureMathAndTagSpacing(sanitized);

  // Step 1: In 'equation' mode, auto-wrap any stray unwrapped math expressions outside existing math spans and [[RED:]] markers
  if (mathFormat === "equation") {
    const atomicSplitRegex =
      /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+?\$|\\\([\s\S]+?\\\)|\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}|\[\[RED:|\]\])/gi;
    let rebuilt = "";
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = atomicSplitRegex.exec(sanitized)) !== null) {
      if (m.index > last) {
        rebuilt += autoWrapUnwrappedMathForEquation(sanitized.slice(last, m.index));
      }
      rebuilt += m[0];
      last = atomicSplitRegex.lastIndex;
    }
    if (last < sanitized.length) {
      rebuilt += autoWrapUnwrappedMathForEquation(sanitized.slice(last));
    }
    sanitized = ensureMathAndTagSpacing(rebuilt);
  }

  // Step 2: Tokenize into Math tokens, RED open/close markers, and Plain text chunks
  type StreamToken =
    | { type: "red_open" }
    | { type: "red_close" }
    | { type: "math"; raw: string; formula: string }
    | { type: "text"; value: string };

  const streamTokens: StreamToken[] = [];
  const masterRegex =
    mathFormat === "latex"
      ? /(\[\[RED:)|(\]\])|(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
      : /(\[\[RED:)|(\]\])|(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)|(\\begin\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|aligned|matrix|pmatrix|bmatrix|vmatrix)\}))/g;

  let ptr = 0;
  let tm: RegExpExecArray | null;
  let openRedDepth = 0;

  while ((tm = masterRegex.exec(sanitized)) !== null) {
    if (tm.index > ptr) {
      streamTokens.push({ type: "text", value: sanitized.slice(ptr, tm.index) });
    }
    if (tm[1]) {
      openRedDepth++;
      streamTokens.push({ type: "red_open" });
    } else if (tm[2]) {
      if (openRedDepth > 0) {
        openRedDepth--;
        streamTokens.push({ type: "red_close" });
      }
      // Stray ']]' without matching '[[RED:' is dropped cleanly
    } else if (mathFormat === "latex" && tm[3]) {
      streamTokens.push({ type: "math", raw: tm[3], formula: tm[3] });
    } else {
      const formula = tm[3] || tm[4] || tm[5] || tm[6] || tm[7] || "";
      streamTokens.push({ type: "math", raw: tm[0], formula });
    }
    ptr = masterRegex.lastIndex;
  }
  if (ptr < sanitized.length) {
    streamTokens.push({ type: "text", value: sanitized.slice(ptr) });
  }

  // Step 3: Stateful Bold / Italic / Code / Heading-hash cleanup across all text tokens!
  // Pre-count '**' and single '*' across text tokens so unmatched stray '*' never corrupt formatting or leak raw '*'!
  const combinedPlain = streamTokens
    .filter((t): t is { type: "text"; value: string } => t.type === "text")
    .map((t) => t.value)
    .join("");

  const hasBalancedDoubleStar = ((combinedPlain.match(/\*\*/g) || []).length >= 2);
  const textWithoutDoubleStars = combinedPlain.replace(/\*{2,}/g, "");
  const singleStarCount = (textWithoutDoubleStars.match(/\*/g) || []).length;
  const allowItalicToggle = singleStarCount >= 2 && singleStarCount % 2 === 0;

  let isRed = false;
  let isBoldToggle = false;
  let isItalicToggle = false;

  const emitText = (rawStr: string) => {
    // Strip stray inline Markdown heading hashes at very start of run if any slipped through, and strip backticks
    const cleaned = cleanPlainProseForWord(rawStr).replace(/`/g, "");
    if (!cleaned) return;
    runs.push(
      new TextRun({
        text: cleaned,
        font: fontName,
        size: fontSize,
        bold: isRed ? false : defaultBold || isBoldToggle,
        italics: isItalicToggle,
        color: isRed ? RED_COLOR : "000000",
      })
    );
  };

  for (const tok of streamTokens) {
    if (tok.type === "red_open") {
      isRed = true;
      continue;
    }
    if (tok.type === "red_close") {
      isRed = false;
      continue;
    }
    if (tok.type === "math") {
      if (mathFormat === "latex") {
        runs.push(
          new TextRun({
            text: tok.raw,
            font: fontName,
            size: fontSize,
            bold: isRed ? false : defaultBold || isBoldToggle,
            color: isRed ? RED_COLOR : "000000",
          })
        );
      } else if (tok.formula) {
        runs.push(convertLatexToDocxMath(tok.formula, isRed));
      }
      continue;
    }

    // Parse '***', '**', '*' inside tok.value
    const s = tok.value;
    let buf = "";
    let idx = 0;
    while (idx < s.length) {
      if (s.startsWith("***", idx)) {
        if (buf) {
          emitText(buf);
          buf = "";
        }
        if (hasBalancedDoubleStar) isBoldToggle = !isBoldToggle;
        if (allowItalicToggle) isItalicToggle = !isItalicToggle;
        idx += 3;
        continue;
      }
      if (s.startsWith("**", idx)) {
        if (buf) {
          emitText(buf);
          buf = "";
        }
        if (hasBalancedDoubleStar) {
          isBoldToggle = !isBoldToggle;
        }
        idx += 2;
        continue;
      }
      if (s[idx] === "*") {
        if (buf) {
          emitText(buf);
          buf = "";
        }
        if (allowItalicToggle) {
          isItalicToggle = !isItalicToggle;
        }
        // Unmatched stray Markdown '*' outside math is stripped so literal '*' NEVER leaks into Word!
        idx += 1;
        continue;
      }
      buf += s[idx];
      idx++;
    }
    if (buf) {
      emitText(buf);
    }
  }

  if (runs.length > 0) return runs;

  return [
    new TextRun({
      text: "",
      font: fontName,
      size: fontSize,
      bold: defaultBold,
    }),
  ];
}

/**
 * Computes proportional column widths (in DXA) for a table:
 * 1. Honors exact column width ratios from the uploaded .docx template (templateProfile) when available!
 * 2. Otherwise applies smart pedagogical proportions (compact STT / Thời gian / Tiết columns, balanced content columns).
 */
function computeTableColumnWidths(
  tableRowsData: string[][],
  colCount: number,
  totalTableWidth: number,
  templateProfile?: DocxTemplateProfile | null
): number[] {
  if (colCount <= 1) return [totalTableWidth];

  const tplRatios = templateProfile?.tableColRatiosByColCount?.[colCount];
  if (tplRatios && tplRatios.length === colCount) {
    const sum = tplRatios.reduce((a, b) => a + b, 0);
    if (sum > 0.9 && sum < 1.1) {
      const widths = tplRatios.map((r) => Math.max(600, Math.round(totalTableWidth * (r / sum))));
      const diff = totalTableWidth - widths.reduce((a, b) => a + b, 0);
      widths[widths.length - 1] += diff;
      return widths;
    }
  }

  // Smart content-aware column sizing based on header row
  const headerCells = (tableRowsData[0] || []).map((c) =>
    c.replace(/[*#]|<br\s*\/?>/gi, " ").trim().toUpperCase()
  );

  const weights = Array.from({ length: colCount }, (_, idx) => {
    const h = headerCells[idx] || "";
    if (/^(?:STT|TT)$/.test(h)) return 0.1;
    if (/^(?:TIẾT|THỜI LƯỢNG|THỜI GIAN|ĐIỂM|MÃ|MỨC ĐỘ)(?:\s*\(.*\))?$/.test(h)) return 0.15;
    if (colCount === 2 && idx === 0 && /HOẠT ĐỘNG/.test(h)) return 0.52;
    if (colCount === 2 && idx === 1) return 0.48;
    return 1 / colCount;
  });

  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const widths = weights.map((w) => Math.max(650, Math.round((w / weightSum) * totalTableWidth)));
  const diff = totalTableWidth - widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += diff;
  return widths;
}

/**
 * Inspects and verifies the actual XML structure inside the generated .docx archive
 * before delivering it to the user, ensuring truthful 100% Equation or Raw LaTeX compliance
 * AND zero leaked Markdown syntax ('**', '###', '####').
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
    docXml.includes("<w:body") &&
    docXml.includes("</w:body>") &&
    docXml.includes("</w:document>");

  if (!xmlValid) {
    issues.push("Cấu trúc word/document.xml thiếu thẻ đóng/mở chuẩn OpenXML.");
  }

  const ommlEquationCount = (docXml.match(/<m:oMath\b/g) || []).length;
  const tableCount = (docXml.match(/<w:tbl\b/g) || []).length;
  const embeddedImageCount = (docXml.match(/<a:blip\b|<v:imagedata\b/g) || []).length;
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
  const textWithoutAnyMath = textWithoutDisplay.replace(/\$[^$]+\$/g, " ");

  // Check for leaked Markdown '**', '###', '####' in plain prose outside math
  const leakedMdMatches = textWithoutAnyMath.match(/\*\*|#{2,6}\s+\S/g) || [];
  const leakedMarkdownSyntaxCount = leakedMdMatches.length;
  if (leakedMarkdownSyntaxCount > 0) {
    issues.push(
      `Phát hiện ${leakedMarkdownSyntaxCount} ký tự Markdown thô (**, ###) chưa được chuyển sang định dạng Word.`
    );
  }

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
    leakedMarkdownSyntaxCount,
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
 * honoring 100% of user-selected FormattingOptions, templateProfile, and mathFormat ('equation' | 'latex').
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
  const tpl = options.templateProfile || null;
  const PAGE_WIDTH_DXA = tpl?.pageWidthDxa || DEFAULT_PAGE_WIDTH_DXA;
  const PAGE_HEIGHT_DXA = tpl?.pageHeightDxa || DEFAULT_PAGE_HEIGHT_DXA;

  const fontName = options.formatting?.fontName || tpl?.fontName || DEFAULT_FONT_NAME;
  const fontSize = options.formatting?.fontSize || tpl?.fontSize || DEFAULT_BASE_FONT_SIZE; // 26 = 13pt
  const TITLE_FONT_SIZE = fontSize + 4; // e.g. 30 = 15pt
  const CAPTION_FONT_SIZE = Math.max(20, fontSize - 4); // e.g. 22 = 11pt
  const LINE_SPACING = options.formatting?.lineSpacing || tpl?.lineSpacing || 240;
  const PARA_SPACING =
    options.formatting?.paraSpacing !== undefined
      ? options.formatting.paraSpacing
      : tpl?.paraSpacing !== undefined
      ? tpl.paraSpacing
      : 120;
  const CELL_PARA_SPACING = Math.max(40, Math.round(PARA_SPACING * 0.5));
  const MARGINS = options.formatting?.margins ||
    tpl?.margins || {
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
      const svgBytes = new TextEncoder().encode(vis.svg);
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

  // 2. Preprocess markdown, collapse multi-line math, reconstruct tables, normalize [[RED:...]] & line breaks
  const preprocessed = preprocessLessonPlanContent(contentWithTokens, MATH_FORMAT);
  const lines = preprocessed.split("\n");
  const paragraphs: (Paragraph | Table)[] = [];

  // Check if content already contains school/teacher banner or comes from teacher's uploaded template
  const first800 = preprocessed.slice(0, 800).toUpperCase();
  const hasExistingHeader =
    !!options.preserveOriginalHeader ||
    !!tpl?.hasSchoolHeader ||
    first800.includes("SỞ GIÁO DỤC") ||
    first800.includes("SỞ GD") ||
    first800.includes("PHÒNG GD") ||
    first800.includes("TRƯỜNG") ||
    first800.includes("UBND") ||
    first800.includes("TỔ:") ||
    first800.includes("TỔ CHUYÊN MÔN") ||
    first800.includes("HỌ VÀ TÊN GIÁO VIÊN") ||
    first800.includes("GIÁO VIÊN:") ||
    first800.includes("NGÀY SOẠN");

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

  const borderColor = tpl?.tableBorderColor || "475569";
  const borderSize = tpl?.tableBorderSize || 4;
  const cellBorderDef = {
    top: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: borderSize, color: borderColor },
  };

  /**
   * Appends text/math paragraphs into a TableCell, stripping any '#' headings,
   * splitting bullets cleanly, and centering standalone $$...$$ blocks.
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
      let p = cleanLineFormatting(piece.trim(), false).trim();
      if (!p) continue;

      // Strip any Markdown heading hashes (#, ##, ###, ####...) inside table cells!
      const headingInfo = stripHeadingHashes(p);
      const isCellSubheading = headingInfo.level > 0;
      if (isCellSubheading) {
        p = headingInfo.text;
        if (!p) continue;
      }

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

      // Centered title inside a 1-column Phiếu học tập box (e.g. PHIẾU HỌC TẬP SỐ 1)
      if (/^PHIẾU HỌC TẬP\b/i.test(p.replace(/^\*+/, ""))) {
        target.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 80, line: LINE_SPACING },
            children: parseInlineRuns(p, true, fontName, fontSize, MATH_FORMAT),
          })
        );
        continue;
      }

      const unwrappedBullet = p.replace(/^\[\[RED:\s*/i, "");
      const bulletMatch = unwrappedBullet.match(/^([-–+•]|\*(?!\*))\s+(.*)$/);
      if (bulletMatch) {
        const isRedWrap = /^(\[\[RED:)/i.test(p);
        const body = isRedWrap ? `[[RED:${bulletMatch[2]}` : bulletMatch[2];
        target.push(
          new Paragraph({
            spacing: { after: CELL_PARA_SPACING, line: LINE_SPACING },
            alignment: isHeaderRow ? AlignmentType.CENTER : AlignmentType.LEFT,
            indent: { left: 180 },
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
            children: parseInlineRuns(
              p,
              isHeaderRow || isCellSubheading,
              fontName,
              fontSize,
              MATH_FORMAT
            ),
          })
        );
      }
    }
  };

  const flushTable = () => {
    if (tableRowsData.length === 0) return;
    const colCount = Math.max(...tableRowsData.map((r) => r.length));
    const totalTableWidth = PAGE_WIDTH_DXA - MARGINS.left - MARGINS.right;
    const colWidths = computeTableColumnWidths(tableRowsData, colCount, totalTableWidth, tpl);

    // A 1-row or 1-column bordered table (e.g. Phiếu học tập box or School Header table) must NOT shade/bold-center the whole box!
    const firstRowJoined = (tableRowsData[0] || []).join(" ").toUpperCase();
    const isSchoolBannerTable =
      tableRowsData.length <= 2 &&
      (firstRowJoined.includes("TRƯỜNG") ||
        firstRowJoined.includes("SỞ GD") ||
        firstRowJoined.includes("CỘNG HÒA XÃ HỘI") ||
        firstRowJoined.includes("TỔ:"));

    const hasDistinctColumnHeaderRow =
      colCount >= 2 && tableRowsData.length >= 2 && !isSchoolBannerTable;

    const rows = tableRowsData.map((rowCells, rowIdx) => {
      const isHeaderRow = hasDistinctColumnHeaderRow && rowIdx === 0;
      const paddedCells = [...rowCells];
      while (paddedCells.length < colCount) paddedCells.push("");

      return new TableRow({
        children: paddedCells.map((cellText, colIdx) => {
          const colWidth = colWidths[colIdx] || Math.floor(totalTableWidth / (colCount || 1));
          const maxCellImgPx = Math.min(Math.max(Math.round(colWidth * 0.056), 170), 340);
          const cellParagraphs: Paragraph[] = [];
          const subLines = cellText.split(/<br\s*\/?>/i);

          subLines.forEach((sub) => {
            const trimmedSub = sub
              .trim()
              .replace(/^&lt;br\s*\/?&gt;\s*[-–*+•]?\s*/i, "")
              .replace(/^<br\s*\/?>\s*[-–*+•]?\s*/i, "")
              .replace(/&lt;br\s*\/?&gt;/gi, " ")
              .replace(/<br\s*\/?>/gi, " ")
              .trim();

            if (!trimmedSub) return;

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
                    const targetDims = resolveAttachmentDisplaySize(
                      imgObj,
                      imgData,
                      maxCellImgPx,
                      Math.round(maxCellImgPx * 1.35)
                    );
                    cellParagraphs.push(
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 60, after: 40, line: LINE_SPACING },
                        children: [
                          new ImageRun({
                            data: imgData,
                            transformation: targetDims,
                            type: imgObj.mimeType?.includes("png") ? "png" : "jpg",
                          }),
                        ],
                      })
                    );
                    if (caption && !/^Hình\s+\d+$/i.test(caption)) {
                      cellParagraphs.push(
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 60, line: LINE_SPACING },
                          children: parseInlineRuns(
                            caption,
                            false,
                            fontName,
                            CAPTION_FONT_SIZE,
                            MATH_FORMAT
                          ),
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

              pushCellTextLines(cellParagraphs, t, isHeaderRow || isSchoolBannerTable);
            }
          });

          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            shading: isHeaderRow ? { fill: "F1F5F9" } : undefined,
            borders: isSchoolBannerTable
              ? {
                  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                }
              : cellBorderDef,
            margins: {
              top: 100,
              bottom: 100,
              left: 130,
              right: 130,
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
          const targetDims = resolveAttachmentDisplaySize(imgObj, imgData, 430, 460);
          paragraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 60, line: LINE_SPACING },
              children: [
                new ImageRun({
                  data: imgData,
                  transformation: targetDims,
                  type: imgObj.mimeType?.includes("png") ? "png" : "jpg",
                }),
              ],
            })
          );
          if (caption && !/^Hình\s+\d+$/i.test(caption)) {
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: PARA_SPACING, line: LINE_SPACING },
                children: parseInlineRuns(caption, false, fontName, CAPTION_FONT_SIZE, MATH_FORMAT),
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

    // Inline [[IMAGE:...]] or [[GEN_SVG:...]] mixed with text on a non-table line: split & emit both!
    const mixedVisualRegex = /(\[\[(?:GEN_SVG|IMAGE):[^:\]]+(?::[^\]]*)?\]\])/;
    if (mixedVisualRegex.test(trimmed)) {
      const mixedParts = trimmed.split(mixedVisualRegex).map((p) => p.trim()).filter(Boolean);
      if (mixedParts.length > 1) {
        lines.splice(i, 1, ...mixedParts);
        continue;
      }
    }

    // Strip ANY Markdown heading prefix (#, ##, ###, ####, #####, ######) cleanly!
    const { level: hashLevel, text: withoutHashes } = stripHeadingHashes(trimmed);
    const activeLine = withoutHashes;
    if (!activeLine) {
      i++;
      continue;
    }

    // 4. Heading 1 / Lesson Title / PHIẾU HỌC TẬP title
    if (
      hashLevel === 1 ||
      /^KẾ HOẠCH BÀI DẠY\b/i.test(activeLine) ||
      /^GIÁO ÁN\b/i.test(activeLine) ||
      /^BÀI\s+\d+\s*[:.\-]/i.test(activeLine) ||
      /^CHỦ ĐỀ\s+\d*\s*[:.\-]/i.test(activeLine) ||
      /^PHIẾU HỌC TẬP(?:\s+SỐ\s*\d+|\s+\d+)?$/i.test(activeLine)
    ) {
      const isWorksheetTitle = /^PHIẾU HỌC TẬP/i.test(activeLine);
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            before: Math.max(PARA_SPACING, 160),
            after: PARA_SPACING,
            line: LINE_SPACING,
          },
          children: parseInlineRuns(
            activeLine.toUpperCase(),
            true,
            fontName,
            isWorksheetTitle ? fontSize + 2 : TITLE_FONT_SIZE,
            MATH_FORMAT
          ),
        })
      );
      i++;
      continue;
    }

    // 5. Main section roman numerals I., II., III., IV., V. or A., B., C. or TIẾT 1, TIẾT 2... or ##
    if (
      hashLevel === 2 ||
      /^[IVXLCDM]+\.\s+/i.test(activeLine) ||
      /^[A-D]\.\s+[A-ZÀ-Ỹ]{2,}/u.test(activeLine) ||
      /^TIẾT\s+\d+\b/i.test(activeLine) ||
      /^PHỤ LỤC\b/i.test(activeLine)
    ) {
      paragraphs.push(
        new Paragraph({
          spacing: {
            before: Math.max(PARA_SPACING, 160),
            after: PARA_SPACING,
            line: LINE_SPACING,
          },
          children: parseInlineRuns(activeLine, true, fontName, fontSize, MATH_FORMAT),
        })
      );
      i++;
      continue;
    }

    // 6. Subsection 1., 2., 3. or a., b., c., d. or Hoạt động... or Phiếu học tập... or ### / #### / ##### / ######
    if (
      hashLevel >= 3 ||
      /^(\d+\.|[a-e][.)])\s+/i.test(activeLine) ||
      /^HOẠT ĐỘNG\s+\d+/i.test(activeLine) ||
      /^Hoạt động\s+\d+/i.test(activeLine) ||
      /^PHIẾU HỌC TẬP\b/i.test(activeLine) ||
      /^BẢNG\s+(?:TIÊU CHÍ|ĐÁNH GIÁ|RUBRIC)\b/i.test(activeLine) ||
      /^Phân bố thời lượng/i.test(activeLine)
    ) {
      // For "a. Mục tiêu: nội dung..." or "1. Kiến thức: nội dung...", bold only the label if there's prose body after ':'
      const labelColonMatch = activeLine.match(/^((?:[a-e][.)]|\d+\.)\s*[^:]{2,32}:)\s+([\s\S]+)$/i);
      if (labelColonMatch && !/^HOẠT ĐỘNG/i.test(activeLine)) {
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
        const isCenteredSub = /^PHIẾU HỌC TẬP\b/i.test(activeLine);
        paragraphs.push(
          new Paragraph({
            alignment: isCenteredSub ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 100, after: Math.max(60, PARA_SPACING), line: LINE_SPACING },
            children: parseInlineRuns(activeLine, true, fontName, fontSize, MATH_FORMAT),
          })
        );
      }
      i++;
      continue;
    }

    // 7. Bullet points: '-', '–', '+', '*', '•' (with or without [[RED:...]] wrapper, avoiding '**bold**')
    const unwrappedForBullet = activeLine.replace(/^\[\[RED:\s*/i, "");
    const bulletMatch = unwrappedForBullet.match(/^([-–+•]|\*(?!\*))\s+(.*)$/);
    if (bulletMatch) {
      const isRedWrapped = /^\[\[RED:/i.test(activeLine);
      const bulletBody = bulletMatch[2];
      const runContent = isRedWrapped ? `[[RED:${bulletBody}` : bulletBody;
      paragraphs.push(
        new Paragraph({
          indent: { left: 320 },
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
    const unwrappedForMath = activeLine.replace(/^\[\[RED:\s*/i, "").replace(/\]\]\s*$/, "").trim();
    if (/^(\$\$[\s\S]+\$\$|\\\[[\s\S]+\\\])$/.test(unwrappedForMath)) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: {
            before: Math.max(80, PARA_SPACING),
            after: Math.max(80, PARA_SPACING),
            line: LINE_SPACING,
          },
          children: parseInlineRuns(activeLine, false, fontName, fontSize, MATH_FORMAT),
        })
      );
      i++;
      continue;
    }

    // 9. Lesson Metadata / Steps / Questions / Worksheet Prompts (no awkward 400-dxa firstLine indent!)
    const isMetadataOrStepLine =
      /^(?:Môn học|Thời gian thực hiện|Thời lượng|Họ và tên|Giáo viên|Trường|Tổ|Ngày soạn|Ngày dạy|Lớp|Tuần|Tiết|Bước\s+\d+|Câu\s+\d+|Bài\s+\d+|Ví dụ\s*\d*|Nhiệm vụ\s*\d*|Lời giải|Hướng dẫn|Đáp án|Gợi ý|Chú ý|Nhận xét|Kết luận)\b/i.test(
        activeLine.replace(/^\*+/, "")
      );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: PARA_SPACING, line: LINE_SPACING },
        ...(isMetadataOrStepLine ? {} : { indent: { firstLine: 360 } }),
        children: parseInlineRuns(activeLine, false, fontName, fontSize, MATH_FORMAT),
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

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  const uint8Array = new Uint8Array(arrayBuffer);
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
