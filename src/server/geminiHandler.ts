import { GoogleGenAI } from "@google/genai";

export function cleanGeminiApiKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== "string") return "";
  return rawKey
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, "");
}

const getGeminiClient = (userApiKey?: string) => {
  const envKey =
    typeof process !== "undefined" && process.env ? process.env.GEMINI_API_KEY : undefined;
  const cleanKey = cleanGeminiApiKey(userApiKey) || cleanGeminiApiKey(envKey);
  if (!cleanKey) {
    throw new Error(
      "Thầy/Cô vui lòng kết nối tài khoản Gmail và nhập khóa Gemini API cá nhân (miễn phí từ aistudio.google.com) để sử dụng, tránh làm cạn kiệt tài nguyên tín dụng của tác giả ứng dụng."
    );
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(cleanKey)) {
    throw new Error(
      "Định dạng khóa API không hợp lệ. Khóa Gemini API chuẩn là chuỗi ký tự bắt đầu bằng AIzaSy... được sao chép từ trang aistudio.google.com/apikey."
    );
  }

  const isBrowser = typeof window !== "undefined";
  return new GoogleGenAI({
    apiKey: cleanKey,
    ...(isBrowser
      ? {}
      : {
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        }),
  });
};

export type LessonMathFormat = "equation" | "latex";
export type PlanGenerationMode = "preserve_old" | "follow_sample" | "new_cv5512";

export interface GenerateLessonPlanPayload {
  userApiKey?: string;
  userEmail?: string;
  userName?: string;
  subject: string;
  grade: string;
  lessonTitle: string;
  lessonDuration: string;
  curriculum?: string;
  mathFormat?: LessonMathFormat;
  planMode?: PlanGenerationMode;
  preservedElements?: string[];
  cv5512Layout?: "Dạng 2 cột" | "Không chia cột";
  formattingOptions?: {
    fontName?: string;
    fontSize?: number; // half-points, e.g. 26 = 13pt
    lineSpacing?: number; // 240 = 1.0, 276 = 1.15, 360 = 1.5
    paraSpacing?: number;
    pageNumber?: string;
    margins?: { top: number; bottom: number; left: number; right: number };
  };
  digitalCompetencies: Array<{
    code: string;
    domain?: string;
    title?: string;
    description?: string;
    levelCode?: string;
    teachingTask?: string;
    yccd?: string;
    fullExplanation?: string;
    suggestedTools?: string;
    isCustom?: boolean;
  }>;
  teacherEquipment: Array<{ name: string; quantity: string; note?: string }>;
  studentEquipment: Array<{ name: string; quantity: string; note?: string }>;
  digitalTools: string[];
  oldLessonPlanText?: string;
  sgkImages?: Array<{ mimeType: string; data: string; name?: string; id?: string }>;
  customNote?: string;
  phuLuc1Text?: string;
  phuLuc3Text?: string;
}

/**
 * Exact verbatim requirement blocks specified by user for 'equation' vs 'latex' modes
 */
export const EQUATION_MODE_VERBATIM_REQUIREMENTS = `Yêu cầu tuyệt đối về công thức toán học
**100% công thức, biểu thức, ký hiệu và số liệu mang ý nghĩa toán học trong toàn bộ file giáo án được xuất ra phải là đối tượng Equation có cấu trúc OMML**, chỉnh sửa được trong Microsoft Word.
- Áp dụng cho mọi phần: kiến thức, ví dụ, bài tập, lời giải, đáp án, bảng biểu, tọa độ, hệ bất phương trình và các cột hoạt động.
- Tuyệt đối không viết công thức bằng văn bản thường, ký tự giả lập hoặc hình ảnh.
- Không để tình trạng chỗ dùng Equation, chỗ viết công thức trực tiếp.
- Kiểm tra cấu trúc XML của DOCX, rà soát công thức còn thiếu Equation và đối chiếu tính chính xác trước khi bàn giao.
- Không khẳng định đã đạt 100% nếu chưa kiểm tra thực tế.
Yêu cầu tuyệt đối về hình vẽ
• Với mọi câu hỏi cần hình học, đồ thị, biểu diễn miền nghiệm hoặc hình minh họa, phải tạo hình ảnh phù hợp và chèn trực tiếp vào đúng vị trí tương ứng.
• Hình phải chính xác về toán học, rõ nét, đúng ký hiệu, nhãn điểm, số liệu và quan hệ hình học. độ dày nét vẽ 1pt, màu hình black`;

export const LATEX_MODE_VERBATIM_REQUIREMENTS = `Yêu cầu tuyệt đối về công thức toán học
Công thức: 100% công thức, ký hiệu toán viết bằng MÃ LaTeX THÔ, hiển thị nguyên văn như chữ thường trong Word (tôi tự chuyển sang Equation sau). Nội dòng $...$, riêng dòng $$...$$ (đoạn riêng, căn giữa). KHÔNG tạo Equation/OMML, MathML, ảnh công thức; không dùng Pandoc tự chuyển $...$. Không dùng ký tự Unicode toán (², √, π, ≤, ≠, ∈, ∞, →, Δ...). Mũ, chỉ số luôn có ngoặc nhọn: x^{2}, a_{n}. Dùng \\frac, \\sqrt, \\le, \\ge, \\in, \\mathbb{R}, \\left(\\right), \\begin{cases}...\\end{cases}, \\overrightarrow{AB}, \\widehat{ABC}, 30^\\circ, \\text{...}; thập phân 2{,}5. Mỗi công thức nằm trọn một dòng, cùng font, không tách định dạng.
- Áp dụng cho mọi phần: kiến thức, ví dụ, bài tập, lời giải, đáp án, bảng biểu, tọa độ, hệ bất phương trình và các cột hoạt động.
- Tuyệt đối không viết công thức bằng văn bản thường, ký tự giả lập hoặc hình ảnh.
- Không để tình trạng chỗ dùng Latex chỗ lại dùng Equation, chỗ viết công thức trực tiếp.
- Kiểm tra cấu trúc XML của DOCX, rà soát công thức còn thiếu Latex và đối chiếu tính chính xác trước khi bàn giao.
- Không khẳng định đã đạt 100% nếu chưa kiểm tra thực tế.
Yêu cầu tuyệt đối về hình vẽ
• Với mọi câu hỏi cần hình học, đồ thị, biểu diễn miền nghiệm hoặc hình minh họa, phải tạo hình ảnh phù hợp và chèn trực tiếp vào đúng vị trí câu hỏi tương ứng.
• Hình phải chính xác về toán học, rõ nét, đúng ký hiệu, nhãn điểm, số liệu và quan hệ hình học. độ dày nét vẽ 1pt, màu hình black`;

// Model fallback list to mitigate temporary spikes in demand (503 UNAVAILABLE)
const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
];

function formatGeminiAuthError(msg: string): string | null {
  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return "Khóa API không hợp lệ. Vui lòng kiểm tra lại mã khóa (bắt đầu bằng AIzaSy...) được tạo từ trang aistudio.google.com/apikey bằng tài khoản Gmail của Thầy/Cô.";
  }
  if (msg.includes("API_KEY_EXPIRED") || msg.includes("API key expired")) {
    return "Khóa Gemini API này đã hết hạn. Thầy/Cô vui lòng mở aistudio.google.com/apikey để tạo khóa API mới miễn phí.";
  }
  if (
    msg.includes("API_KEY_SERVICE_BLOCKED") ||
    msg.includes("CONSUMER_SUSPENDED") ||
    msg.includes("Generative Language API has not been used")
  ) {
    return "Khóa API hiện bị chặn quyền truy cập dịch vụ Generative Language API (403). Vui lòng tạo khóa API mới trong dự án mặc định trên aistudio.google.com/apikey.";
  }
  return null;
}

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  requestParams: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;
  let transientError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: requestParams.contents,
          config: requestParams.config,
        });
        if (response && (response.text !== undefined || response.candidates)) {
          return response;
        }
      } catch (err: any) {
        const msg = err?.message || String(err);

        const authErr = formatGeminiAuthError(msg);
        if (authErr) {
          throw new Error(authErr);
        }

        const isTemporarySpike =
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand") ||
          msg.includes("overloaded") ||
          msg.includes("temporarily unavailable") ||
          msg.includes("Resource has been exhausted") ||
          msg.includes("429");

        if (isTemporarySpike) {
          transientError = err;
          lastError = err;
          console.warn(
            `[Gemini Call] Model ${modelName} (lần thử ${attempt}) gặp tình trạng quá tải tạm thời (503/429). Đang tự động thử lại...`
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        } else {
          if (!transientError) {
            lastError = err;
          }
          break;
        }
      }
    }
  }

  const primaryError = transientError || lastError;
  const errorMsg = primaryError?.message || "";
  if (
    errorMsg.includes("503") ||
    errorMsg.includes("high demand") ||
    errorMsg.includes("UNAVAILABLE")
  ) {
    throw new Error(
      "Máy chủ Google AI hiện đang có lượng truy cập tăng đột biến trên toàn cầu (503 High Demand). Hệ thống đã tự động thử các mô hình dự phòng nhưng chưa thành công. Thầy/Cô vui lòng bấm nút thử lại sau 5-10 giây."
    );
  }
  if (errorMsg.includes("429") || errorMsg.includes("Resource has been exhausted")) {
    throw new Error(
      "Tài khoản Gmail hiện đã chạm giới hạn tần suất gọi API tạm thời của Google (429 Quota/Rate Limit). Thầy/Cô vui lòng đợi khoảng 30-60 giây rồi thử lại."
    );
  }

  throw primaryError;
}

export async function handleVerifyAccount(apiKey: string) {
  const cleanKey = cleanGeminiApiKey(apiKey);
  if (!cleanKey) {
    throw new Error("Vui lòng nhập khóa API được tạo từ tài khoản Gmail của Thầy/Cô.");
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(cleanKey)) {
    throw new Error(
      "Định dạng khóa API không hợp lệ. Khóa Gemini API chuẩn bắt đầu bằng AIzaSy... và không chứa khoảng trắng hay dấu tiếng Việt."
    );
  }

  try {
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=20&key=${encodeURIComponent(
      cleanKey
    )}`;
    const res = await fetch(modelsUrl, { method: "GET" });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch (_) {}

    if (res.ok && data && Array.isArray(data.models)) {
      return {
        valid: true,
        message:
          "Xác thực tài khoản Gmail và khóa Gemini API cá nhân thành công! Hạn ngạch miễn phí đã sẵn sàng.",
      };
    }

    const errPayload = JSON.stringify(data?.error || text || "");
    const authErr = formatGeminiAuthError(errPayload);
    if (authErr) {
      throw new Error(authErr);
    }

    if (res.status === 403 || res.status >= 500) {
      const ai = getGeminiClient(cleanKey);
      await callGeminiWithFallback(ai, {
        contents: "Xin chào",
        config: { maxOutputTokens: 5 },
      });
      return {
        valid: true,
        message:
          "Xác thực tài khoản Gmail và khóa Gemini API cá nhân thành công! Hạn ngạch miễn phí đã sẵn sàng.",
      };
    }

    throw new Error(
      data?.error?.message || `Không thể xác thực khóa API (Mã phản hồi HTTP ${res.status}).`
    );
  } catch (err: any) {
    console.error("Account verification error:", err);
    const msg = err?.message || String(err);
    const authErr = formatGeminiAuthError(msg);
    if (authErr) {
      throw new Error(authErr);
    }
    if (
      msg.includes("Khóa API") ||
      msg.includes("Định dạng khóa API") ||
      msg.includes("Khóa Gemini API")
    ) {
      throw err;
    }
    throw new Error(`Lỗi kết nối tài khoản: ${msg || "Không thể xác thực khóa"}`);
  }
}

/**
 * Counts unescaped pipe delimiters outside inline $...$ / $$...$$ math spans.
 */
function countTablePipesOutsideMath(line: string): number {
  let count = 0;
  let inMath = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && (line[i + 1] === "|" || line[i + 1] === "$")) {
      i++;
      continue;
    }
    if (ch === "$") {
      if (line[i + 1] === "$") {
        inMath = !inMath;
        i++;
      } else {
        inMath = !inMath;
      }
      continue;
    }
    if (ch === "|" && !inMath) count++;
  }
  return count;
}

/**
 * Repairs multi-line Markdown table rows where AI put literal '\n' inside table cells instead of '<br>'.
 */
function reconstructMultilineTablesInOutput(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed.startsWith("|")) {
      if (trimmed.endsWith("|")) {
        result.push(trimmed);
        i++;
        continue;
      }

      let expectedPipes = 0;
      const prev = result.length > 0 ? result[result.length - 1].trim() : "";
      if (prev.startsWith("|") && prev.endsWith("|")) {
        expectedPipes = countTablePipesOutsideMath(prev);
      }

      let acc = trimmed;
      let pipes = countTablePipesOutsideMath(acc);
      let j = i + 1;
      let closed = false;

      while (j < lines.length && j - i <= 50) {
        const nextTrim = lines[j].trim();
        if (!nextTrim) {
          j++;
          continue;
        }
        if (nextTrim.startsWith("|") && expectedPipes > 0 && pipes >= expectedPipes) {
          break;
        }
        acc += "<br>" + nextTrim;
        pipes = countTablePipesOutsideMath(acc);
        j++;
        if (acc.endsWith("|") && (expectedPipes === 0 || pipes >= expectedPipes)) {
          closed = true;
          break;
        }
      }

      if (closed) {
        result.push(acc);
        i = j;
        continue;
      }
    }

    result.push(raw);
    i++;
  }

  return result;
}

/**
 * Ensures spaces are never swallowed around [[RED:...]] or $...$ spans ("không dính chữ").
 */
function ensureCleanTagAndMathSpacing(text: string): string {
  if (!text) return text;
  let out = text;

  // Move spaces trapped at start/end inside [[RED: ... ]] to outside so adjacent words never glue
  out = out.replace(/(\S?)\[\[RED:([ \t]*)([\s\S]*?)([ \t]*)\]\](\S?)/gi, (_, prev, leadWs, inner, trailWs, next) => {
    const trimmedInner = inner.trim();
    if (!trimmedInner) return `${prev}${leadWs || trailWs ? " " : ""}${next}`;
    const needLeftSpace =
      prev &&
      !/[\s([{"'“‘<>/\-–|]/.test(prev) &&
      (leadWs.length > 0 || /^[\p{L}\p{N}$\\]/u.test(trimmedInner));
    const needRightSpace =
      next &&
      !/[\s)\]}"'”’.,;:!?><\/\-–|]/.test(next) &&
      (trailWs.length > 0 || /[\p{L}\p{N}$)]$/u.test(trimmedInner));
    return `${prev}${needLeftSpace ? " " : ""}[[RED:${trimmedInner}]]${needRightSpace ? " " : ""}${next}`;
  });

  // Ensure space between Vietnamese letter and inline $math$
  out = out.replace(
    /([\p{L}])(\$\$[^$\n]+?\$\$|\$[^$\n]+?\$)/gu,
    "$1 $2"
  );
  out = out.replace(
    /(\$\$[^$\n]+?\$\$|\$[^$\n]+?\$)([\p{L}])/gu,
    "$1 $2"
  );

  return out;
}

export function sanitizeLessonPlanOutput(
  text: string,
  mathFormat: LessonMathFormat = "equation",
  options?: { allowEmptyHD2Fallback?: boolean }
): string {
  if (!text) return "";

  // 0. Strip outer ```markdown ... ``` code fence if AI wrapped the whole response
  let working = text.trim();
  if (/^```(?:markdown|md|text)?\s*\r?\n/i.test(working) && /\r?\n```\s*$/.test(working)) {
    working = working.replace(/^```(?:markdown|md|text)?\s*\r?\n/i, "").replace(/\r?\n```\s*$/, "");
  }

  // 1. Protect inline <svg>...</svg> blocks (collapsing internal newlines so they never break Markdown table rows!)
  const protectedSvgs: string[] = [];
  working = working.replace(
    /```(?:svg|xml|html)?\s*([\s\S]*?<svg\b[\s\S]*?<\/svg>[\s\S]*?)```/gi,
    (_, inner: string) => {
      const m = inner.match(/<svg\b[\s\S]*?<\/svg>/i);
      if (!m) return inner;
      const singleLineSvg = m[0]
        .replace(/\r?\n/g, " ")
        .replace(/\|/g, "&#124;")
        .replace(/\s{2,}/g, " ")
        .trim();
      const idx = protectedSvgs.length;
      protectedSvgs.push(singleLineSvg);
      return `@@SVG_PROTECTED_${idx}@@`;
    }
  );

  working = working.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svgBlock: string) => {
    const singleLineSvg = svgBlock
      .replace(/\r?\n/g, " ")
      .replace(/\|/g, "&#124;")
      .replace(/\s{2,}/g, " ")
      .trim();
    const idx = protectedSvgs.length;
    protectedSvgs.push(singleLineSvg);
    return `@@SVG_PROTECTED_${idx}@@`;
  });

  // 2. Collapse multi-line $$...$$ and \[...\] onto a single line before line-by-line processing
  working = working
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner: string) => `$$${inner.replace(/\r?\n/g, " ").trim()}$$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner: string) =>
      mathFormat === "latex"
        ? `$$${inner.replace(/\r?\n/g, " ").trim()}$$`
        : `\\[${inner.replace(/\r?\n/g, " ").trim()}\\]`
    );

  // 3. Normalize case-insensitivity for [[RED:...]] while strictly preserving outer leading/trailing spaces!
  let normalized = working.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  normalized = normalized.replace(/\[\[RED:([\s\S]*?)\]\]/gi, (_, inner: string) => {
    const leadSpace = /^[ \t]+/.test(inner) ? " " : "";
    const trailSpace = /[ \t]+$/.test(inner) ? " " : "";
    const lines = inner.split("\n");
    const body = lines
      .map((line: string) => {
        if (!line.trim()) return line;
        if (/<br\s*\/?>/i.test(line)) {
          return line
            .split(/(<br\s*\/?>)/i)
            .map((seg: string) => {
              if (/<br\s*\/?>/i.test(seg) || !seg.trim()) return seg;
              const sLead = /^[ \t]+/.test(seg) ? " " : "";
              const sTrail = /[ \t]+$/.test(seg) ? " " : "";
              const cleanSeg = seg.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "").trim();
              return cleanSeg ? `${sLead}[[RED:${cleanSeg}]]${sTrail}` : "";
            })
            .join("");
        }
        const cleanLine = line.replace(/\[\[\s*RED:?/gi, "").replace(/\]\]/g, "").trim();
        return cleanLine ? `[[RED:${cleanLine}]]` : "";
      })
      .join("\n");
    return `${leadSpace}${body}${trailSpace}`;
  });

  // 4. Reconstruct multi-line Markdown table rows where AI put literal '\n' inside cells
  const rawLines = reconstructMultilineTablesInOutput(normalized.split(/\r?\n/));
  const preprocessedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cleanedCellBreaks = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "<br>– ")
        .replace(/<br\s*\/?>\s*[-–]\s*/gi, "<br>– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>");
      preprocessedLines.push(cleanedCellBreaks);
    } else if (/<br\s*\/?>/i.test(line) || /&lt;br\s*\/?&gt;/i.test(line)) {
      const parts = line
        .replace(/&lt;br\s*\/?&gt;\s*[-–]\s*/gi, "\n– ")
        .replace(/<br\s*\/?>\s*[-–]\s*/gi, "\n– ")
        .replace(/&lt;br\s*\/?&gt;/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .split("\n");
      for (const part of parts) {
        const pTrimmed = part.trim();
        if (pTrimmed) {
          preprocessedLines.push(pTrimmed);
        }
      }
    } else {
      preprocessedLines.push(line);
    }
  }

  let processed = preprocessedLines
    .map((line) => {
      let l = line.trimEnd();
      const isTableRow = l.trim().startsWith("|") && l.trim().endsWith("|");

      if (!isTableRow) {
        // Replace any remaining <br> with space (NEVER empty string!)
        l = l.replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ");
        l = l.replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ");
        l = l.replace(/&lt;br\s*\/?&gt;/gi, " ");
        l = l.replace(/<br\s*\/?>/gi, " ");

        l = l.replace(/^[\s*.]+(?=[IVXLCDM]+\b[.\:\s])/i, "");
        l = l.replace(/^[\s*.]+(?=\d+[.)\:\s])/i, "");
        l = l.replace(/^[\s*.]+(?=[a-z][.)]\s)/i, "");
        l = l.replace(
          /^[\s*.]+(?=(?:Hoạt động|HOẠT ĐỘNG|MỤC TIÊU|Mục tiêu|TIẾN TRÌNH|Tiến trình|THIẾT BỊ|Thiết bị|HỒ SƠ|Hồ sơ|PHỤ LỤC|Phụ lục|HƯỚNG DẪN|Hướng dẫn|PHIẾU HỌC TẬP|Phiếu học tập)[\s\:\.])/i,
          ""
        );

        // Skip horizontal divider lines (***)
        if (/^\*{3,}$/.test(l.trim())) {
          return "";
        }

        l = l.replace(/^\*\*(.*?)\*\*$/, "$1");
        l = l.replace(/^[\s*.]+\*\*(.*?)\*\*/, "$1");
        l = l.replace(/\*+\s*([.,;:!?])/g, "$1");
        l = l.replace(/([.,;:!?])\*+\s*$/g, "$1");
        // Only strip trailing unmatched single '*' (do NOT strip closing '**' of an inline bold span!)
        if (((l.match(/\*\*/g) || []).length % 2) !== 0 || (!/\*\*\s*$/.test(l) && /\*\s*$/.test(l))) {
          const singleCheck = l.replace(/\*\*/g, "");
          if (((singleCheck.match(/\*/g) || []).length % 2) !== 0) {
            l = l.replace(/\*+\s*$/g, "");
          }
        }
      } else {
        // Inside table cells: strip leaked Markdown heading hashes '### ' or '#### ' right after '|' or '<br>'
        l = l.replace(/(\|\s*)#{1,6}\s+/g, "$1");
        l = l.replace(/(<br\s*\/?>\s*)#{1,6}\s+/gi, "$1");
      }

      l = l.replace(/\[\[\s*red\s*:/gi, "[[RED:");
      l = l.replace(/\[\[RED:\s*\*\*(.*?)\*\*\s*\]\]/gi, "[[RED:$1]]");
      l = l.replace(/\[\[RED:\s*\*(.*?)\*\s*\]\]/gi, "[[RED:$1]]");
      l = l.replace(/\[\[RED:(.*?)\*+\]\]/gi, "[[RED:$1]]");

      const opens = (l.match(/\[\[RED:/g) || []).length;
      const closes = (l.match(/\]\]/g) || []).length;
      if (opens > closes) {
        l += "]]".repeat(opens - closes);
      }

      const dollarCount = (l.match(/(?<!\\)\$/g) || []).length;
      if (dollarCount % 2 !== 0 && !l.includes("$$")) {
        l += "$";
      }

      l = ensureCleanTagAndMathSpacing(l);

      // Fix arbitrary Title Case capitalization
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
    })
    .join("\n");

  // Safeguard ONLY when authoring a 2-column CV5512 plan (never override non-column or preserve_old plans)
  if (options?.allowEmptyHD2Fallback !== false) {
    const emptyHĐ2Regex =
      /(d[.)]\s*Tổ chức thực hiện:\s*)(?=(?:3\.\s*Hoạt động luyện tập|Hoạt động 3\s*:?\s*Luyện tập|###\s*3\.\s*Hoạt động luyện tập|###\s*Hoạt động 3|HOẠT ĐỘNG 3))/i;
    if (emptyHĐ2Regex.test(processed)) {
      const defaultHĐ2Implementation = `d. Tổ chức thực hiện:
| HOẠT ĐỘNG CỦA GIÁO VIÊN VÀ HỌC SINH | SẢN PHẨM (YÊU CẦU CẦN ĐẠT) |
| --- | --- |
| **Bước 1: Chuyển giao nhiệm vụ**<br>– GV yêu cầu học sinh nghiên cứu nội dung SGK, quan sát học liệu và thảo luận nhóm hoàn thành nhiệm vụ học tập.<br>[[RED:– GV trình chiếu học liệu số, phần mềm đồ họa/mô phỏng tương tác trên Smart TV/máy chiếu để học sinh quan sát và thao tác trực quan.]]<br><br>**Bước 2: Thực hiện nhiệm vụ**<br>– Các nhóm học sinh đọc SGK, thảo luận tích cực và ghi nhận kết quả vào phiếu học tập.<br>[[RED:– HS sử dụng thiết bị số khai thác phần mềm chuyên dụng hoặc học liệu số để kiểm chứng và giải quyết nhiệm vụ.]]<br><br>**Bước 3: Báo cáo, thảo luận**<br>– Đại diện nhóm trình bày kết quả, các nhóm khác lắng nghe, đối chiếu, đặt câu hỏi phản biện.<br><br>**Bước 4: Kết luận, nhận định**<br>– GV nhận xét tinh thần làm việc nhóm và chuẩn hóa kiến thức trọng tâm bài học.<br>[[RED:– Đánh giá kỹ năng thao tác công cụ số chính xác, hiệu quả của học sinh.]] | – Kết quả hoàn thành các câu hỏi, bài tập khám phá kiến thức và phiếu học tập được chuẩn hóa đầy đủ, chính xác theo yêu cầu cần đạt. |

`;
      processed = processed.replace(emptyHĐ2Regex, defaultHĐ2Implementation);
    }
  }

  // Restore protected single-line <svg>...</svg> drawings
  processed = processed.replace(/@@SVG_PROTECTED_(\d+)@@/g, (_, idxStr) => {
    return protectedSvgs[Number(idxStr)] || "";
  });

  return processed;
}

/**
 * Inspects an uploaded old/sample lesson plan to extract its exact structural fingerprint:
 * - Table headers & column counts
 * - Exact [[IMAGE:id:caption]] tags that must be preserved verbatim
 * - Worksheet (Phiếu học tập) presence
 */
function analyzeUploadedPlanBlueprint(oldPlanText: string): {
  imageTags: string[];
  tableHeaders: string[];
  hasTables: boolean;
  hasWorksheets: boolean;
  hasSchoolHeader: boolean;
} {
  if (!oldPlanText || !oldPlanText.trim()) {
    return {
      imageTags: [],
      tableHeaders: [],
      hasTables: false,
      hasWorksheets: false,
      hasSchoolHeader: false,
    };
  }

  const imageTags = Array.from(
    new Set(oldPlanText.match(/\[\[IMAGE:[^\]]+\]\]/gi) || [])
  );

  const lines = oldPlanText.split(/\r?\n/);
  const tableHeaders: string[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    const nxt = lines[i + 1].trim();
    if (
      cur.startsWith("|") &&
      cur.endsWith("|") &&
      /^\|[\s\-:|]+\|$/.test(nxt)
    ) {
      if (!tableHeaders.includes(cur) && tableHeaders.length < 6) {
        tableHeaders.push(cur);
      }
    }
  }

  const hasWorksheets = /PHIẾU\s+HỌC\s+TẬP/i.test(oldPlanText);
  const hasSchoolHeader = /(?:TRƯỜNG|SỞ\s+GD|PHÒNG\s+GD|TỔ\s*:|TỔ\s+CHUYÊN\s+MÔN)/i.test(
    oldPlanText.slice(0, 800)
  );

  return {
    imageTags,
    tableHeaders,
    hasTables: tableHeaders.length > 0,
    hasWorksheets,
    hasSchoolHeader,
  };
}

function resolveEffectivePlanMode(payload: GenerateLessonPlanPayload): PlanGenerationMode {
  const hasOldPlan = Boolean(payload.oldLessonPlanText && payload.oldLessonPlanText.trim());
  if (!hasOldPlan) return "new_cv5512";

  if (payload.planMode === "preserve_old" || payload.planMode === "follow_sample" || payload.planMode === "new_cv5512") {
    return payload.planMode;
  }

  const note = (payload.customNote || "").toLowerCase();
  if (note.includes("soạn mới hoàn toàn")) return "new_cv5512";
  if (note.includes("bám sát")) return "follow_sample";
  return "preserve_old";
}

export async function handleGenerateLessonPlan(payload: GenerateLessonPlanPayload) {
  const ai = getGeminiClient(payload.userApiKey);
  const mathFormat: LessonMathFormat = payload.mathFormat === "latex" ? "latex" : "equation";
  const effectiveMode = resolveEffectivePlanMode(payload);
  const preservedList =
    payload.preservedElements && payload.preservedElements.length > 0
      ? payload.preservedElements
      : ["Cấu trúc", "Bố cục", "Nội dung", "Hình ảnh", "Công thức toán học", "Phiếu học tập"];
  const cv5512Layout = payload.cv5512Layout || "Dạng 2 cột";
  const blueprint = analyzeUploadedPlanBlueprint(payload.oldLessonPlanText || "");

  const selectedFont = payload.formattingOptions?.fontName || "Times New Roman";
  const selectedPt = payload.formattingOptions?.fontSize
    ? Math.round(payload.formattingOptions.fontSize / 2)
    : 13;
  const selectedMarginDesc =
    payload.formattingOptions?.margins?.left === 720
      ? "lề hẹp 1,27 cm các cạnh"
      : "lề trái 2,5 cm, các lề còn lại 1,5 cm";

  const mathAndFigurePromptBlock =
    mathFormat === "latex"
      ? LATEX_MODE_VERBATIM_REQUIREMENTS
      : EQUATION_MODE_VERBATIM_REQUIREMENTS;

  const mathTechnicalExecutionGuide =
    mathFormat === "latex"
      ? `HƯỚNG DẪN KỸ THUẬT XUẤT MÃ LATEX THÔ:
- Toàn bộ 100% công thức, biến số ($x$, $y$), tọa độ ($O(0; 0)$, $A(0; 100)$, $B(20; 80)$, $(x_{0}; y_{0})$), trục tọa độ ($Oxy$, $Ox$, $Oy$), phương trình, bất phương trình, hàm số ($F(x, y) = 3{,}5x + 2y$) PHẢI đặt trong $...$ (nội dòng) hoặc $$...$$ (dòng riêng căn giữa).
- Tuyệt đối KHÔNG dùng bất kỳ ký tự Unicode toán học nào (như ², ³, ₀, √, π, ≤, ≥, ≠, ∈, ℝ, ∞, →, ⇒, ⇔, Δ...). Phải dùng đúng lệnh LaTeX: x^{2}, x_{0}, \\frac{a}{b}, \\sqrt{x}, \\le, \\ge, \\neq, \\in, \\mathbb{R}, \\left( ... \\right), \\begin{cases} ... \\end{cases}, \\overrightarrow{AB}, \\widehat{ABC}, 30^\\circ, số thập phân viết 2{,}5 hoặc 3{,}5x.
- Mũ và chỉ số dưới LUÔN LUÔN có ngoặc nhọn: viết x^{2}, a_{n}, x_{0}, y_{0} (không viết x^2 hay x_0).
- Mỗi công thức $...$ hoặc $$...$$ phải nằm trọn trên MỘT DÒNG duy nhất, không xuống dòng bên trong công thức.`
      : `HƯỚNG DẪN KỸ THUẬT BIÊN DỊCH 100% ĐỐI TƯỢNG EQUATION OMML WORD:
- Để bộ biên dịch XML DOCX của hệ thống chuyển đổi tự động 100% biểu thức sang đối tượng Equation có cấu trúc OMML (<m:oMath>, <m:f>, <m:rad>, <m:sSup>, <m:sSub>, <m:eqArr>, <m:acc>) chỉnh sửa trực tiếp trong Microsoft Word, bạn BẮT BUỘC bao mọi công thức, biểu thức, biến số ($x$, $y$), số liệu mang ý nghĩa toán học, mặt phẳng/trục tọa độ ($Oxy$, $Ox$, $Oy$), tọa độ điểm ($O(0; 0)$, $A(0; 100)$, $B(20; 80)$, $(x_{0}; y_{0})$), biểu thức ($F(x, y) = 3{,}5x + 2y$) và hệ bất phương trình ($$\\begin{cases} x \\ge 0 \\\\ y \\ge 0 \\\\ x + y \\le 100 \\\\ 2x + y \\le 120 \\end{cases}$$) trong cặp dấu $...$ (nội dòng) hoặc $$...$$ (dòng riêng).
- Tuyệt đối không để sót bất kỳ công thức hay biến số toán học nào ở dạng văn bản thường ngoài dấu $...$. Mỗi công thức viết gọn trên một dòng.`;

  const svgFigureTechnicalGuide = `HƯỚNG DẪN KỸ THUẬT HÌNH ẢNH GỐC & TẠO HÌNH VẼ VECTOR TRỰC TIẾP (NÉT 1PT, MÀU BLACK):
- Bảo toàn 100% mọi thẻ hình ảnh gốc dạng [[IMAGE:id:Chú thích]] có trong giáo án đính kèm tại đúng vị trí cũ (tuyệt đối không xóa, không đổi mã id).
- Với các câu hỏi, ví dụ, bài tập hoặc lời giải cần vẽ thêm hình học, đồ thị hàm số, trục số, biểu diễn miền nghiệm hoặc hình minh họa khoa học mà chưa có ảnh gốc: TẠO TRỰC TIẾP mã hình vẽ vector <svg> chính xác và đặt ngay tại vị trí câu hỏi hoặc cột sản phẩm tương ứng:
  1. Thẻ mở chuẩn: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 270" width="360" height="270" data-caption="Hình ...: Tên chú thích hình rõ ràng">...</svg>
  2. Nền trắng (#ffffff), độ dày MỌI nét vẽ đúng 1pt (stroke-width="1.33"), màu nét vẽ ĐEN TUYỆT ĐỐI (stroke="#000000").
  3. Miền nghiệm đa giác (nếu có) tô màu xám nhạt đơn sắc fill="#e5e5e5" với đường biên stroke="#000000" stroke-width="1.33"; đường gióng tọa độ dùng nét đứt stroke="#000000" stroke-width="1.33" stroke-dasharray="4,3".
  4. Tính chính xác tọa độ toán học sang SVG (y_svg = y_goc - ty_le * y_toan), vẽ trục Ox, Oy có mũi tên đen, gốc O, chấm tròn đen tại các đỉnh và ghi nhãn bằng <text font-family="Times New Roman, serif" font-size="13" fill="#000000">.
  5. Toàn bộ khối <svg ...>...</svg> PHẢI VIẾT LIỀN TRÊN CÙNG MỘT DÒNG (không chứa \\n và không chứa ký tự |), ngăn cách với văn bản trước/sau bằng <br> nếu ở trong bảng.`;

  const strictWordFormattingHygiene = `QUY TẮC TUYỆT ĐỐI CHỐNG DÍNH CHỮ, CHỐNG MẤT NGẮT DÒNG & CHỐNG RÒ RỈ KÝ TỰ MARKDOWN (*, #) KHI XUẤT WORD:
1. KHÔNG DÍNH CHỮ: Luôn có dấu cách (khoảng trắng) chuẩn tiếng Việt giữa chữ thường với thẻ [[RED:...]], công thức $...$ và chữ in đậm **...** (ví dụ viết: "Học sinh [[RED:sử dụng GeoGebra]] để vẽ đồ thị hàm số $y = 2x + 1$ trên mặt phẳng").
2. NGẮT DÒNG RÕ RÀNG:
   - Ở NGOÀI bảng: Mỗi tiêu đề mục (I, II, III, 1, 2, a, b, c, d), mỗi Bước 1, Bước 2, Bước 3, Bước 4, mỗi ý gạch đầu dòng (– ...) và mỗi đáp án trắc nghiệm/câu hỏi trong Phiếu học tập PHẢI xuống dòng riêng biệt (\\n). Tuyệt đối không viết gộp nhiều bước hay nhiều mục trên cùng một dòng!
   - Ở BÊN TRONG ô bảng Markdown (| Cột 1 | Cột 2 |): Mỗi hàng bảng phải nằm trên một dòng Markdown; các đoạn văn, các Bước 1..4 và các gạch đầu dòng bên trong cùng một ô PHẢI ngăn cách bằng thẻ <br> (tuyệt đối KHÔNG dùng ký tự xuống dòng \\n thô bên trong ô bảng làm vỡ hàng bảng!).
3. KHÔNG ĐỂ LỌT KÝ TỰ ĐẶC BIỆT (*, #, ***):
   - Tuyệt đối KHÔNG dùng dấu # (như ###, ####) ở bên trong ô bảng Markdown!
   - Không dùng dấu * để làm gạch đầu dòng (hãy dùng dấu gạch ngang "– " hoặc "- ").
   - Không dùng dòng kẻ ngang "***" hay "---" ở ngoài bảng.
   - Khi in đậm chỉ dùng cặp **...** đóng mở cân xứng hoàn toàn, KHÔNG bao giờ dùng **...** bọc cắt ngang qua ranh giới thẻ [[RED:...]]. Bên trong [[RED:...]] tuyệt đối KHÔNG dùng ** hay * (vì chữ năng lực số chỉ tô đỏ, không in đậm).`;

  const competenciesText =
    payload.digitalCompetencies && payload.digitalCompetencies.length > 0
      ? payload.digitalCompetencies
          .map(
            (c) => `- MÃ CHỈ BÁO [${c.code}] (${c.domain || "Năng lực số"})${
              c.isCustom ? " [DO GIÁO VIÊN TỰ DÁN/ĐỊNH NGHĨA]" : ""
            }:
    + Yêu cầu cần đạt (YCCD): ${c.yccd || c.title || c.description}
    + Diễn giải cụ thể: ${c.fullExplanation || c.description || c.title}${
              c.suggestedTools ? `\n    + Công cụ/thiết bị: ${c.suggestedTools}` : ""
            }`
          )
          .join("\n\n")
      : "Tự động phân bổ các chỉ báo năng lực số thiết yếu phù hợp nhất với bài học theo văn bản 3456/BGDĐT-GDPT.";

  const teacherEqText =
    payload.teacherEquipment && payload.teacherEquipment.length > 0
      ? payload.teacherEquipment
          .map((e) => `- ${e.name}: ${e.quantity}${e.note ? ` (${e.note})` : ""}`)
          .join("\n")
      : "Laptop giáo viên, Smart TV / Máy chiếu, kết nối Internet tốc độ cao.";

  const studentEqText =
    payload.studentEquipment && payload.studentEquipment.length > 0
      ? payload.studentEquipment
          .map((e) => `- ${e.name}: ${e.quantity}${e.note ? ` (${e.note})` : ""}`)
          .join("\n")
      : "Điện thoại thông minh / máy tính bảng theo nhóm, SGK, vở ghi.";

  const toolsText =
    payload.digitalTools && payload.digitalTools.length > 0
      ? payload.digitalTools.join(", ")
      : "Padlet, Quizizz, GeoGebra, Desmos, ChatGPT/Gemini, Canva.";

  const blueprintSummaryLines: string[] = [];
  if (blueprint.hasSchoolHeader) {
    blueprintSummaryLines.push("- Giáo án gốc có phần tiêu ngữ Trường / Tổ chuyên môn ở đầu trang -> PHẢI GIỮ NGUYÊN, không tự ý thay bằng tiêu đề khác.");
  }
  if (blueprint.hasTables) {
    blueprintSummaryLines.push(
      `- Giáo án gốc sử dụng cấu trúc bảng với tiêu đề cột chính xác:\n  ${blueprint.tableHeaders.join("\n  ")}\n  -> BẮT BUỘC GIỮ ĐÚNG SỐ CỘT VÀ NGUYÊN VĂN TÊN CÁC CỘT NÀY!`
    );
  } else if (payload.oldLessonPlanText && payload.oldLessonPlanText.trim()) {
    blueprintSummaryLines.push(
      "- Giáo án gốc trình bày tiến trình hoạt động dạng văn bản tuần tự KHÔNG CHIA CỘT -> BẮT BUỘC GIỮ NGUYÊN BỐ CỤC KHÔNG CHIA CỘT (tuyệt đối không tự ý ép thành bảng 2 cột)!"
    );
  }
  if (blueprint.imageTags.length > 0) {
    blueprintSummaryLines.push(
      `- Giáo án gốc có ${blueprint.imageTags.length} hình ảnh đính kèm bắt buộc phải giữ nguyên 100% đúng mã thẻ tại đúng vị trí:\n  ${blueprint.imageTags.join(", ")}`
    );
  }
  if (blueprint.hasWorksheets) {
    blueprintSummaryLines.push(
      "- Giáo án gốc có phần PHIẾU HỌC TẬP -> BẮT BUỘC GIỮ NGUYÊN ĐẦY ĐỦ 100% các Phiếu học tập, câu hỏi, phương án A/B/C/D, bảng biểu và công thức của các Phiếu học tập!"
    );
  }

  let modeContextInstruction = "";
  if (effectiveMode === "preserve_old") {
    modeContextInstruction = `✦ CHẾ ĐỘ ĐANG KÍCH HOẠT: "THÊM NĂNG LỰC SỐ NHƯNG GIỮ NGUYÊN GIÁO ÁN GỐC" (BẢO TOÀN NGUYÊN BẢN TUYỆT ĐỐI)
Giáo viên đã chọn bảo toàn nguyên vẹn các thành phần sau của Giáo án đính kèm: [${preservedList.join(", ")}].
QUY TẮC BẮT BUỘC 100%:
1. GIỮ NGUYÊN NGUYÊN VĂN 100% cấu trúc đề mục, bố cục trình bày (chia cột hoặc không chia cột, số lượng cột, tên cột), toàn bộ nội dung kiến thức, câu hỏi, ví dụ, lời giải, công thức toán học, toàn bộ thẻ hình ảnh [[IMAGE:...]] và toàn bộ các PHIẾU HỌC TẬP của giáo án gốc đính kèm ở Mục 6!
2. TUYỆT ĐỐI KHÔNG ĐƯỢC tóm tắt, không lược bỏ bất kỳ dòng/câu hỏi/bài tập/phiếu học tập nào, không đổi tên tiêu đề mục, không tự ý áp đặt khung mẫu khác đè lên giáo án gốc!
3. CHỈ CHÈN THÊM các đoạn tích hợp Năng lực số bọc trong [[RED:...]] vào đúng các vị trí hợp lý:
   - Tại phần Mục tiêu / Năng lực: bổ sung mục Năng lực số [[RED:...]] liệt kê đầy đủ 100% mã chỉ báo đã chọn và diễn giải sát bài học.
   - Tại phần Thiết bị dạy học & học liệu: bổ sung [[RED:...]] các thiết bị số và phần mềm số của GV & HS.
   - Tại từng Hoạt động học (Khởi động, Hình thành kiến thức, Luyện tập, Vận dụng): chèn thêm các bước/thao tác ứng dụng công cụ số của GV và HS bọc trong [[RED:...]] (nếu hoạt động gốc ở trong ô bảng thì nối thêm bằng <br>[[RED:– ...]] ngay trong ô đó; nếu ở ngoài bảng thì thêm dòng mới [[RED:– ...]]).
   - Tại cuối giáo án (sau phần Phiếu học tập gốc được giữ nguyên): bổ sung [[RED:...]] tiêu chí/Bảng Rubric đánh giá năng lực số ngắn gọn, thiết thực.
${blueprintSummaryLines.join("\n")}`;
  } else if (effectiveMode === "follow_sample") {
    modeContextInstruction = `✦ CHẾ ĐỘ ĐANG KÍCH HOẠT: "SOẠN MỚI BÁM SÁT GIÁO ÁN CŨ / GIÁO ÁN MẪU" (KẾ THỪA KHUÔN MẪU 1:1)
Giáo viên đã chọn biên soạn bám sát chặt chẽ các thành phần của Giáo án cũ / Giáo án mẫu đính kèm: [${preservedList.join(", ")}].
QUY TẮC BẮT BUỘC 100%:
1. Lấy Giáo án đính kèm ở Mục 6 làm KHUÔN MẪU CHUẨN 1:1 (Blueprint) về hình thức, cấu trúc đề mục, cách đánh số (I, II, III / 1, 2, 3 / a, b, c, d / Bước 1..4), bố cục bảng biểu (giữ đúng y hệt số cột và tiêu đề từng cột của giáo án mẫu; nếu mẫu không chia cột thì tuyệt đối không chia cột!), phong cách trình bày công thức và thiết kế mẫu PHIẾU HỌC TẬP!
2. Nếu giáo án đính kèm là giáo án cũ của chính bài "${payload.lessonTitle}": bảo toàn toàn bộ mạch nội dung cốt lõi, ví dụ, bài tập, thẻ hình ảnh [[IMAGE:...]] và toàn bộ các Phiếu học tập của giáo án cũ (theo đúng các mục [${preservedList.join(", ")}] đã chọn), đồng thời chuẩn hóa công thức, bổ sung hình vẽ <svg> nét 1pt màu black ở những chỗ cần minh họa toán học/khoa học và tích hợp sâu sắc các mã chỉ báo Năng lực số trong thẻ [[RED:...]].
3. Nếu giáo án đính kèm là mẫu khung của bài khác dùng để soạn cho bài mới "${payload.lessonTitle}": biên soạn đầy đủ toàn bộ kiến thức, ví dụ, lời giải, hình vẽ <svg> 1pt black và Phiếu học tập của bài "${payload.lessonTitle}" (bám sát SGK & Phụ lục 1, Phụ lục 3) nhưng PHẢI ĐÚC ĐÚNG 100% VÀO KHUÔN BỐ CỤC, KIỂU BẢNG VÀ MẪU PHIẾU HỌC TẬP CỦA GIÁO ÁN MẪU!
${blueprintSummaryLines.join("\n")}`;
  } else {
    const activityOrganizationSpec =
      cv5512Layout === "Không chia cột"
        ? `d. Tổ chức thực hiện: (CHẾ ĐỘ KHÔNG CHIA CỘT - Trình bày tuần tự từng đoạn rõ ràng, TUYỆT ĐỐI KHÔNG kẻ bảng chia 2 cột cho phần tiến trình):
         - Bước 1: Chuyển giao nhiệm vụ: ...
         - Bước 2: Thực hiện nhiệm vụ: ...
         - Bước 3: Báo cáo, thảo luận: ...
         - Bước 4: Kết luận, nhận định (kèm Sản phẩm dự kiến, định nghĩa, lời giải chi tiết và chèn trực tiếp hình vẽ <svg> 1pt black): ...`
        : `d. Tổ chức thực hiện:
         Bảng 2 cột Markdown chuẩn:
         | HOẠT ĐỘNG CỦA GIÁO VIÊN VÀ HỌC SINH | SẢN PHẨM (YÊU CẦU CẦN ĐẠT) |
         | --- | --- |
         Bên cột trái trình bày rõ đủ **Bước 1: Chuyển giao nhiệm vụ**, **Bước 2: Thực hiện nhiệm vụ**, **Bước 3: Báo cáo, thảo luận**, **Bước 4: Kết luận, nhận định**. Bên cột phải trình bày ĐẦY ĐỦ định nghĩa, quy tắc, lời giải chi tiết từng ví dụ/luyện tập/bài tập SGK và CHÈN TRỰC TIẾP hình vẽ <svg> minh họa chuẩn toán học ngay trong cột sản phẩm!`;

    modeContextInstruction = `✦ CHẾ ĐỘ ĐANG KÍCH HOẠT: "SOẠN MỚI HOÀN TOÀN BÁM SÁT SGK & CÔNG VĂN 5512" (${cv5512Layout.toUpperCase()})
Biên soạn đầy đủ, sâu sắc theo đúng cấu trúc chuẩn Kế hoạch bài dạy Công văn 5512/BGDĐT-GDTrH:
   - Phần tiêu đề đầu bài:
     # KẾ HOẠCH BÀI DẠY
     # ${payload.lessonTitle.toUpperCase()}
     Môn học/Hoạt động giáo dục: ${payload.subject} – ${payload.grade} (Bộ sách ${payload.curriculum || "Chương trình GDPT 2018"})
     Thời gian thực hiện: ${payload.lessonDuration}
   - I. MỤC TIÊU:
     1. Kiến thức: (Nêu đầy đủ yêu cầu cần đạt kiến thức chuẩn SGK & Phụ lục 1)
     2. Năng lực:
        - Năng lực chung: (Tự chủ và tự học; Giao tiếp và hợp tác; Giải quyết vấn đề và sáng tạo)
        - Năng lực đặc thù / Năng lực riêng bộ môn: (Nêu cụ thể gắn với bài học)
        - Năng lực số (NLS): [[RED:Liệt kê đầy đủ từng mã chỉ báo đã chọn kèm diễn giải cụ thể sát nội dung bài học]]
     3. Phẩm chất: (Chăm chỉ, Trung thực, Trách nhiệm)
   - II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU:
     1. Đối với giáo viên: (Phản ánh chính xác danh mục thiết bị GV và phần mềm số đã chọn, bôi đỏ [[RED:...]] các học liệu/phần mềm số)
     2. Đối với học sinh: (Phản ánh chính xác danh mục thiết bị HS chuẩn bị, bôi đỏ [[RED:...]] các thiết bị/ứng dụng số)
   - III. TIẾN TRÌNH DẠY HỌC:
     * Mở đầu mục III bằng bảng hoặc danh sách **Phân bố thời lượng dạy học (${payload.lessonDuration}):** phân chia rõ từng tiết.
     * Soạn đầy đủ, chi tiết toàn bộ 4 chuỗi hoạt động:
       + HOẠT ĐỘNG 1: HOẠT ĐỘNG KHỞI ĐỘNG (... phút)
       + HOẠT ĐỘNG 2: HÌNH THÀNH KIẾN THỨC MỚI (... phút) -> Chia nhỏ mạch lạc thành Hoạt động 2.1, Hoạt động 2.2... theo đúng các mục kiến thức trong SGK!
       + HOẠT ĐỘNG 3: LUYỆN TẬP (... phút) (Trắc nghiệm tương tác trên công cụ số + lời giải chi tiết các bài tập SGK)
       + HOẠT ĐỘNG 4: VẬN DỤNG (... phút) (Giải quyết bài toán thực tiễn có lời giải, kết luận số liệu trọn vẹn)
     * Mỗi hoạt động ĐỀU PHẢI CÓ ĐỦ 4 MỤC:
       a. Mục tiêu: ...
       b. Nội dung: ... (Ghi rõ mã chỉ báo NLS tích hợp tại hoạt động đó trong thẻ [[RED:...]])
       c. Sản phẩm: ...
       ${activityOrganizationSpec}
   - IV. HƯỚNG DẪN VỀ NHÀ:
     1. Ôn tập kiến thức
     2. Bài tập về nhà
     3. Chuẩn bị bài mới
   - V. PHỤ LỤC:
     1. Các Phiếu học tập (chi tiết từng phiếu sử dụng trong bài, trình bày rõ câu hỏi, công thức và khoảng trống/phương án trả lời)
     2. Bảng tiêu chí đánh giá (Rubric đánh giá hoạt động nhóm có tiêu chí ứng dụng công nghệ số [[RED:...]])`;
  }

  const systemInstruction = `✦ R (Role - Vai trò) - Gán vai chuyên gia:
Bạn là giáo viên chuyên môn môn ${payload.subject}, ${payload.grade} có nhiều năm kinh nghiệm, am hiểu sâu sắc Chương trình GDPT 2018, Công văn 5512/BGDĐT-GDTrH, Văn bản 3456/BGDĐT-GDPT và phương pháp dạy học phát triển phẩm chất, năng lực học sinh.

✦ T (Task - Nhiệm vụ) - Chỉ định sản phẩm chính:
Hãy biên soạn Kế hoạch bài dạy (Giáo án) tích hợp năng lực số hoàn chỉnh cho bài: "${payload.lessonTitle}" (Bộ sách: ${payload.curriculum || "Chương trình GDPT 2018"}, Thời gian thực hiện: ${payload.lessonDuration}) để xuất thành file Word (.docx) chuẩn mực dùng được ngay trên lớp.

✦ C (Context - Chế độ biên soạn & Khuôn mẫu bắt buộc):
${modeContextInstruction}

✦ F / O (Format / Output Format - Quy chuẩn bắt buộc):
1. TÔ ĐỎ NĂNG LỰC SỐ: Toàn bộ 100% nội dung mới liên quan trực tiếp đến năng lực số (mã chỉ báo, công cụ số, thao tác số của GV & HS, tiêu chí đánh giá số) PHẢI bọc trong [[RED:...]] (chữ thường, KHÔNG dùng ** bên trong [[RED:...]], đóng ]] đầy đủ). Toàn bộ nội dung kiến thức môn học thông thường giữ màu đen bình thường (ngoài thẻ [[RED:...]]).
2. ${mathAndFigurePromptBlock}

${mathTechnicalExecutionGuide}

${svgFigureTechnicalGuide}

${strictWordFormattingHygiene}

3. QUY CHUẨN TRANG IN & CHÍNH TẢ:
   - Khổ A4; ${selectedMarginDesc}; Font ${selectedFont}, cỡ ${selectedPt}pt.
   - Tuyệt đối KHÔNG sử dụng chú thích ngoặc vuông rác dạng [...] hay [i].
   - Viết hoa đúng ngữ pháp tiếng Việt, không viết hoa tùy tiện từng từ (Title Case).`;

  const promptParts: any[] = [];

  if (payload.sgkImages && payload.sgkImages.length > 0) {
    for (const img of payload.sgkImages) {
      const isPdf = img.mimeType === "application/pdf" || (img.data && img.data.startsWith("JVBER"));
      promptParts.push({
        inlineData: {
          mimeType: isPdf ? "application/pdf" : img.mimeType || "image/jpeg",
          data: img.data,
        },
      });
    }
  }

  const modeHumanLabel =
    effectiveMode === "preserve_old"
      ? `THÊM NĂNG LỰC SỐ NHƯNG GIỮ NGUYÊN GIÁO ÁN ĐÍNH KÈM (${preservedList.join(", ")})`
      : effectiveMode === "follow_sample"
      ? `SOẠN MỚI BÁM SÁT 1:1 GIÁO ÁN CŨ / GIÁO ÁN MẪU (${preservedList.join(", ")})`
      : `SOẠN MỚI HOÀN TOÀN BÁM SÁT SGK & CV 5512 (${cv5512Layout})`;

  const promptText = `Hãy thực hiện biên soạn Kế hoạch bài dạy tích hợp năng lực số đáp ứng CHÍNH XÁC 100% các thông số và chế độ do giáo viên đã lựa chọn dưới đây:

1. THÔNG TIN BÀI HỌC & CHẾ ĐỘ SOẠN BÀI ĐÃ CHỌN:
- Chế độ biên soạn: ${modeHumanLabel}
- Môn học / Hoạt động giáo dục: ${payload.subject}
- Khối lớp: ${payload.grade}
- Tên bài dạy: ${payload.lessonTitle}
- Thời lượng giảng dạy: ${payload.lessonDuration}
- Bộ sách giáo khoa: ${payload.curriculum || "Chương trình GDPT 2018"}
- Chế độ công thức toán & hình vẽ đã chọn: ${
    mathFormat === "latex"
      ? "LATEX (100% mã LaTeX thô $...$ và $$...$$, không OMML, không ký tự Unicode toán, kèm hình vẽ 1pt black)"
      : "EQUATION (100% đối tượng Equation OMML chỉnh sửa được trong Word, kèm hình vẽ 1pt black)"
  }
- Định dạng trang in đã chọn: Font ${selectedFont}, cỡ chữ ${selectedPt}pt, ${selectedMarginDesc}
${payload.userEmail ? `- Giáo viên thực hiện: ${payload.userName || "Thầy/Cô"} (${payload.userEmail})` : ""}

2. CĂN CỨ PHỤ LỤC 1 (KẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN):
${
  payload.phuLuc1Text && payload.phuLuc1Text.trim()
    ? payload.phuLuc1Text
    : "(Áp dụng Yêu cầu cần đạt chuẩn Chương trình GDPT 2018 của bài học, phân bổ thời lượng hợp lý)"
}

3. CĂN CỨ PHỤ LỤC 3 & CÁC MÃ CHỈ BÁO NĂNG LỰC SỐ ĐÃ TÍCH CHỌN (BẮT BUỘC TÍCH HỢP ĐẦY ĐỦ 100% CÁC MÃ NÀY VÀ BÔI ĐỎ TRONG [[RED:...]]):
${payload.phuLuc3Text && payload.phuLuc3Text.trim() ? `* Trích từ Phụ lục 3:\n${payload.phuLuc3Text}\n` : ""}
* Danh sách mã chỉ báo năng lực số bắt buộc xuất hiện ở phần Mục tiêu năng lực và phân bổ cụ thể vào các Hoạt động học:
${competenciesText}

4. THIẾT BỊ DẠY HỌC & PHẦN MỀM SỐ ĐÃ TÍCH CHỌN:
* Thiết bị Giáo viên:
${teacherEqText}
* Thiết bị Học sinh:
${studentEqText}
* Phần mềm / Nền tảng số khai thác:
${toolsText}

${
  payload.sgkImages && payload.sgkImages.length > 0
    ? `5. TÀI LIỆU SGK ĐÍNH KÈM (${payload.sgkImages.length} tài liệu ảnh/PDF):
- Bám sát chuẩn xác định nghĩa, ví dụ, số liệu, hình vẽ và bài tập trong tài liệu SGK đính kèm.
- Giữ nguyên mọi thẻ [[IMAGE:...]] của giáo án gốc (nếu có) và vẽ trực tiếp hình toán học/đồ thị bằng <svg> nét 1pt màu black rõ nét cho các câu hỏi cần hình vẽ.\n`
    : ""
}
6. GIÁO ÁN GỐC / GIÁO ÁN MẪU ĐÍNH KÈM CỦA GIÁO VIÊN:
${
  payload.oldLessonPlanText && payload.oldLessonPlanText.trim()
    ? `--- BẮT ĐẦU NỘI DUNG GIÁO ÁN ĐÍNH KÈM ---\n${payload.oldLessonPlanText}\n--- KẾT THÚC NỘI DUNG GIÁO ÁN ĐÍNH KÈM ---`
    : "(Không có giáo án cũ đính kèm — hãy biên soạn mới hoàn chỉnh theo chuẩn Công văn 5512 với đầy đủ lời giải chi tiết, hình vẽ <svg> 1pt black, Hướng dẫn về nhà và Phụ lục Phiếu học tập + Rubric)"
}

${payload.customNote ? `7. GHI CHÚ RIÊNG CỦA GIÁO VIÊN:\n${payload.customNote}\n` : ""}
8. KIỂM TRA CUỐI CÙNG TRƯỚC KHI XUẤT KẾT QUẢ:
- Đảm bảo KHÔNG dính chữ, mỗi đoạn/bước ngắt dòng rõ ràng, KHÔNG để sót ký tự thô *, **, ###, #### trong văn bản hay trong ô bảng.
- ${
    effectiveMode === "preserve_old"
      ? `Đảm bảo giữ nguyên 100% bố cục, nội dung, công thức, toàn bộ ${blueprint.imageTags.length} thẻ [[IMAGE:...]] và toàn bộ các Phiếu học tập của Giáo án đính kèm ở Mục 6; chỉ chèn thêm các mục [[RED:...]].`
      : effectiveMode === "follow_sample"
      ? "Đảm bảo giáo án xuất ra tuân thủ đúng 100% cấu trúc chia cột/không chia cột, tiêu đề mục, hình ảnh, công thức và mẫu Phiếu học tập của Giáo án mẫu ở Mục 6."
      : `Đảm bảo trình bày đúng bố cục "${cv5512Layout}" đã chọn.`
  }
- Tuân thủ tuyệt đối quy chuẩn công thức và hình vẽ:
${mathAndFigurePromptBlock}`;

  promptParts.push({ text: promptText });

  const response = await callGeminiWithFallback(ai, {
    contents: {
      parts: promptParts,
    },
    config: {
      systemInstruction,
      temperature: 0.1,
      maxOutputTokens: 65536,
    },
  });

  const raw = response.text || "";
  const allowEmptyHD2Fallback =
    effectiveMode === "new_cv5512" && cv5512Layout !== "Không chia cột";
  const cleaned = sanitizeLessonPlanOutput(raw, mathFormat, { allowEmptyHD2Fallback });

  return {
    rawContent: cleaned,
  };
}

export async function handleExtractPlanPdf(pdfBase64: string, userApiKey?: string) {
  const ai = getGeminiClient(userApiKey);
  const response = await callGeminiWithFallback(ai, {
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64,
          },
        },
        {
          text: `Bạn là chuyên gia sư phạm và công cụ trích xuất tài liệu dạy học chuyên nghiệp.
Hãy trích xuất TOÀN BỘ 100% NỘI DUNG của tệp PDF Kế hoạch bài dạy (Giáo án) này sang định dạng Markdown chuẩn mực:
1. TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT, KHÔNG RÚT GỌN, KHÔNG BỎ SÓT BẤT KỲ CÂU CHỮ, ĐOẠN VĂN, CÔNG THỨC HAY PHIẾU HỌC TẬP NÀO.
2. BẢO TỒN NGUYÊN VẸN CẤU TRÚC BẢNG BIỂU / CHIA CỘT DƯỚI DẠNG BẢNG MARKDOWN (| Cột 1 | Cột 2 | ... |) theo đúng số cột và tên cột thực tế của tài liệu (các đoạn văn bên trong cùng một ô cách nhau bằng thẻ <br>, tuyệt đối không xuống dòng \\n thô bên trong ô bảng). Nếu tài liệu gốc không chia cột thì giữ nguyên văn bản không chia cột.
3. Toàn bộ các công thức toán học trích xuất sang LaTeX chuẩn trong $...$ hoặc $$...$$.
4. Ở các vị trí có tranh ảnh/sơ đồ/bản vẽ, đặt thẻ: [[IMAGE:hinh_x:Hình x. Chú thích hình ảnh]]
5. Giữ nguyên đầy đủ 100% các Phiếu học tập và đáp án ở cuối giáo án (nếu có).
6. Trả về toàn văn bản Markdown hoàn chỉnh từ trang đầu đến trang cuối cùng.`,
        },
      ],
    },
    config: {
      temperature: 0.1,
      maxOutputTokens: 65536,
    },
  });

  return {
    text: response.text || "",
  };
}

export async function handleAnalyzeSgk(
  images: Array<{ mimeType: string; data: string; name?: string }>,
  userApiKey?: string
) {
  const ai = getGeminiClient(userApiKey);

  const promptParts: any[] = [];
  for (const img of images) {
    const isPdf = img.mimeType === "application/pdf" || (img.data && img.data.startsWith("JVBER"));
    promptParts.push({
      inlineData: {
        mimeType: isPdf ? "application/pdf" : img.mimeType || "image/jpeg",
        data: img.data,
      },
    });
  }

  promptParts.push({
    text: `Bạn là chuyên gia sư phạm phân tích tài liệu sách giáo khoa (SGK) Việt Nam.
Hãy phân tích kỹ các tài liệu SGK đính kèm (bao gồm ảnh chụp và tệp PDF các trang SGK bài học) và trích xuất chi tiết:
1. Tên bài học chính xác và bộ sách giáo khoa tương ứng (Kết nối tri thức, Chân trời sáng tạo, Cánh diều...).
2. Yêu cầu cần đạt / Mục tiêu cốt lõi của bài học ghi trong SGK.
3. Thuật ngữ, khái niệm, công thức toán học/khoa học và nội dung cốt lõi của bài học.
4. Danh sách các hình minh họa, biểu đồ, đồ thị miền nghiệm, bản vẽ, bảng số liệu, thí nghiệm hoặc hoạt động khám phá trong SGK.
5. Tiến trình hoạt động học trong SGK (Khởi động, Khám phá/Hình thành kiến thức, Luyện tập, Vận dụng).
6. Đề xuất các hoạt động tích hợp năng lực số (NLS) phù hợp nhất với nội dung bài học (ví dụ: công cụ tìm kiếm dữ liệu, GeoGebra/Desmos, Quizizz/Padlet, ứng dụng AI...).
Trả về ngắn gọn, sư phạm, chuyên nghiệp bằng tiếng Việt để giáo viên tham khảo và tích hợp vào giáo án.`,
  });

  const response = await callGeminiWithFallback(ai, {
    contents: {
      parts: promptParts,
    },
    config: {
      systemInstruction: "Bạn là chuyên gia sư phạm phân tích sách giáo khoa Việt Nam.",
      temperature: 0.2,
    },
  });

  return {
    analysis: response.text || "",
  };
}
