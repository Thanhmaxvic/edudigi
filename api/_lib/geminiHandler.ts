import { GoogleGenAI } from "@google/genai";

const getGeminiClient = (userApiKey?: string) => {
  const envKey = typeof process !== "undefined" && process.env ? process.env.GEMINI_API_KEY : undefined;
  const apiKey = (userApiKey && userApiKey.trim()) || envKey;
  if (!apiKey) {
    throw new Error(
      "Thầy/Cô vui lòng kết nối tài khoản Gmail và nhập khóa Gemini API cá nhân (miễn phí từ aistudio.google.com) để sử dụng, tránh làm cạn kiệt tài nguyên tín dụng của tác giả ứng dụng."
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

export type LessonMathFormat = "equation" | "latex";

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
];

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  requestParams: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;

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
        lastError = err;
        const msg = err?.message || String(err);
        const isTemporarySpike =
          msg.includes("503") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("high demand") ||
          msg.includes("overloaded") ||
          msg.includes("temporarily unavailable") ||
          msg.includes("Resource has been exhausted") ||
          msg.includes("429");

        if (isTemporarySpike) {
          console.warn(
            `[Gemini Call] Model ${modelName} (lần thử ${attempt}) gặp tình trạng quá tải tạm thời (503/429). Đang tự động thử lại...`
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        } else {
          break;
        }
      }
    }
  }

  const errorMsg = lastError?.message || "";
  if (
    errorMsg.includes("503") ||
    errorMsg.includes("high demand") ||
    errorMsg.includes("UNAVAILABLE")
  ) {
    throw new Error(
      "Máy chủ Google AI hiện đang có lượng truy cập tăng đột biến trên toàn cầu (503 High Demand). Hệ thống đã tự động thử các mô hình dự phòng nhưng chưa thành công. Thầy/Cô vui lòng bấm nút thử lại sau 5-10 giây."
    );
  }

  throw lastError;
}

export async function handleVerifyAccount(apiKey: string) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Vui lòng nhập khóa API được tạo từ tài khoản Gmail của Thầy/Cô.");
  }
  const cleanKey = apiKey.trim();
  const ai = new GoogleGenAI({
    apiKey: cleanKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  try {
    await callGeminiWithFallback(ai, {
      contents: "Xin chào",
      config: {
        maxOutputTokens: 10,
      },
    });

    return {
      valid: true,
      message: "Xác thực tài khoản Gmail và khóa Gemini API cá nhân thành công! Hạn ngạch miễn phí đã sẵn sàng.",
    };
  } catch (err: any) {
    console.error("Account verification error:", err);
    throw new Error(
      err.message?.includes("API key not valid")
        ? "Khóa API không hợp lệ. Vui lòng kiểm tra lại mã khóa tạo từ trang aistudio.google.com/apikey bằng tài khoản Gmail của Thầy/Cô."
        : `Lỗi kết nối tài khoản: ${err.message || "Không thể xác thực khóa"}`
    );
  }
}

export function sanitizeLessonPlanOutput(
  text: string,
  mathFormat: LessonMathFormat = "equation"
): string {
  if (!text) return "";

  // 0. Protect inline <svg>...</svg> blocks (collapsing internal newlines so they never break Markdown table rows!)
  const protectedSvgs: string[] = [];
  let working = text.replace(/```(?:svg|xml|html)?\s*([\s\S]*?<svg\b[\s\S]*?<\/svg>[\s\S]*?)```/gi, (_, inner: string) => {
    const m = inner.match(/<svg\b[\s\S]*?<\/svg>/i);
    if (!m) return inner;
    const singleLineSvg = m[0].replace(/\r?\n/g, " ").replace(/\|/g, "&#124;").replace(/\s{2,}/g, " ").trim();
    const idx = protectedSvgs.length;
    protectedSvgs.push(singleLineSvg);
    return `@@SVG_PROTECTED_${idx}@@`;
  });

  working = working.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svgBlock: string) => {
    const singleLineSvg = svgBlock.replace(/\r?\n/g, " ").replace(/\|/g, "&#124;").replace(/\s{2,}/g, " ").trim();
    const idx = protectedSvgs.length;
    protectedSvgs.push(singleLineSvg);
    return `@@SVG_PROTECTED_${idx}@@`;
  });

  // Collapse multi-line $$...$$ and \[...\] onto a single line before line-by-line processing
  working = working
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner: string) => `$$${inner.replace(/\r?\n/g, " ").trim()}$$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner: string) =>
      mathFormat === "latex"
        ? `$$${inner.replace(/\r?\n/g, " ").trim()}$$`
        : `\\[${inner.replace(/\r?\n/g, " ").trim()}\\]`
    );

  // Normalize case-insensitivity and spacing for [[RED:
  let normalized = working.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  // 1. Normalize multi-line [[RED:...]] tags across newlines and <br>
  normalized = normalized.replace(/\[\[RED:([\s\S]*?)\]\]/gi, (_, inner) => {
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

  const rawLines = normalized.split("\n");
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

      if (!l.startsWith("|") || !l.endsWith("|")) {
        l = l.replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ");
        l = l.replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ");
        l = l.replace(/&lt;br\s*\/?&gt;/gi, "");
        l = l.replace(/<br\s*\/?>/gi, "");
      }

      l = l.replace(/^[\s*.]+(?=[IVXLCDM]+\b[\.\:\s])/i, "");
      l = l.replace(/^[\s*.]+(?=\d+[\.\)\:\s])/i, "");
      l = l.replace(/^[\s*.]+(?=[a-z][\.\)]\s)/i, "");
      l = l.replace(
        /^[\s*.]+(?=(?:Hoạt động|HOẠT ĐỘNG|MỤC TIÊU|Mục tiêu|TIẾN TRÌNH|Tiến trình|THIẾT BỊ|Thiết bị|HỒ SƠ|Hồ sơ|PHỤ LỤC|Phụ lục|HƯỚNG DẪN|Hướng dẫn)[\s\:\.])/i,
        ""
      );

      l = l.replace(/^\*\*(.*?)\*\*$/, "$1");
      l = l.replace(/^[\s*.]+\*\*(.*?)\*\*/, "$1");

      l = l.replace(/\*+\s*([.,;:!?])/g, "$1");
      l = l.replace(/([.,;:!?])\*+\s*$/g, "$1");
      l = l.replace(/\*+\s*$/g, "");

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

  // Safeguard: detect if "d) Tổ chức thực hiện:" of Hoạt động 2 was left empty before Hoạt động 3
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

  // Restore protected single-line <svg>...</svg> drawings
  processed = processed.replace(/@@SVG_PROTECTED_(\d+)@@/g, (_, idxStr) => {
    return protectedSvgs[Number(idxStr)] || "";
  });

  return processed;
}

export async function handleGenerateLessonPlan(payload: GenerateLessonPlanPayload) {
  const ai = getGeminiClient(payload.userApiKey);
  const mathFormat: LessonMathFormat = payload.mathFormat === "latex" ? "latex" : "equation";

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

  const svgFigureTechnicalGuide = `HƯỚNG DẪN KỸ THUẬT TẠO HÌNH VẼ TOÁN HỌC / HÌNH MINH HỌA TRỰC TIẾP (NÉT 1PT, MÀU BLACK):
- Với MỌI hoạt động, ví dụ, bài tập, lời giải cần hình học, đồ thị hàm số, trục số, biểu diễn miền nghiệm (ví dụ: miền nghiệm tam giác $OAB$, miền nghiệm tứ giác $OABC$ tối ưu lợi nhuận, hình minh họa kiểm tra miền nghiệm...) hoặc hình vẽ khoa học: bạn PHẢI TẠO TRỰC TIẾP mã hình vẽ vector <svg> chính xác và đặt ngay tại đúng vị trí câu hỏi hoặc ngay bên trong ô cột "SẢN PHẨM (YÊU CẦU CẦN ĐẠT)" tương ứng!
- Quy chuẩn bắt buộc cho mọi thẻ <svg>:
  1. Thẻ mở chuẩn: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 270" width="360" height="270" data-caption="Hình ...: Tên chú thích hình rõ ràng">...</svg>
  2. Nền trắng (#ffffff), độ dày MỌI nét vẽ đúng 1pt (stroke-width="1.33"), màu nét vẽ ĐEN TUYỆT ĐỐI (stroke="#000000").
  3. Miền nghiệm đa giác (nếu có) tô màu xám nhạt đơn sắc fill="#e5e5e5" với đường biên stroke="#000000" stroke-width="1.33"; đường gióng tọa độ dùng nét đứt stroke="#000000" stroke-width="1.33" stroke-dasharray="4,3".
  4. Tính toán chính xác tỉ lệ tọa độ toán học sang tọa độ SVG (lưu ý trục tung SVG hướng xuống dưới nên y_svg = y_goc - ty_le * y_toan). Vẽ trục Ox, Oy có mũi tên đen, gốc O, đánh dấu chấm tròn đen (<circle cx="..." cy="..." r="2.5" fill="#000000"/>) tại các đỉnh/điểm đặc biệt và ghi đầy đủ ký hiệu đỉnh, nhãn trục, số liệu tọa độ bằng <text x="..." y="..." font-family="Times New Roman, serif" font-size="13" fill="#000000">...</text> rõ nét, không chồng lấn.
  5. QUAN TRỌNG KHI ĐẶT TRONG BẢNG MARKDOWN: Toàn bộ khối <svg ...>...</svg> PHẢI VIẾT LIỀN TRÊN CÙNG MỘT DÒNG (không chứa ký tự xuống dòng \\n và không chứa ký tự gạch đứng |), ngăn cách với văn bản trước/sau bằng thẻ <br> để bảng 2 cột hiển thị và xuất Word hoàn hảo 100%!`;

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

  const systemInstruction = `✦ R (Role - Vai trò) - Gán vai chuyên gia:
Bạn là giáo viên chuyên môn môn ${payload.subject}, ${payload.grade} có nhiều năm kinh nghiệm, am hiểu sâu sắc Chương trình GDPT 2018, Công văn 5512/BGDĐT-GDTrH, Văn bản 3456/BGDĐT-GDPT và phương pháp dạy học phát triển phẩm chất, năng lực học sinh.

✦ T (Task - Nhiệm vụ) - Chỉ định sản phẩm chính:
Hãy biên soạn Kế hoạch bài dạy (Giáo án) tích hợp năng lực số hoàn chỉnh, sâu sắc, chi tiết từng lời giải/ví dụ/bài tập cho bài: "${payload.lessonTitle}" (Bộ sách: ${payload.curriculum || "Chương trình GDPT 2018"}, Thời gian thực hiện: ${payload.lessonDuration}) để xuất thành file Word (.docx) chuẩn mực dùng được ngay trên lớp.

✦ C (Context - Bối cảnh & Căn cứ 4 Nguồn Tài liệu & Cấu trúc Giáo án mẫu chuẩn):
1. Nếu có Nguồn 1 (Bài soạn gốc của GV): Bảo toàn cấu trúc, nội dung cốt lõi, câu hỏi, bài tập và nâng cấp tích hợp năng lực số. Nếu chưa có bài soạn gốc, biên soạn đầy đủ theo đúng cấu trúc chuẩn của Giáo án mẫu tích hợp năng lực số CV 5512:
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
        - Năng lực số (NLS): [[RED:Liệt kê đầy đủ từng mã chỉ báo đã chọn (ví dụ 1.1.NC1b, 2.1.NC1a, 5.2.NC1b, 6.2.NC1a...) kèm diễn giải cụ thể sát nội dung bài học]]
     3. Phẩm chất: (Chăm chỉ, Trung thực, Trách nhiệm)
   - II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU:
     1. Đối với giáo viên: (Phản ánh chính xác danh mục thiết bị GV và phần mềm số đã chọn, bôi đỏ [[RED:...]] các học liệu/phần mềm số)
     2. Đối với học sinh: (Phản ánh chính xác danh mục thiết bị HS chuẩn bị, bôi đỏ [[RED:...]] các thiết bị/ứng dụng số)
   - III. TIẾN TRÌNH DẠY HỌC:
     * Mở đầu mục III bằng bảng hoặc danh sách **Phân bố thời lượng dạy học (${payload.lessonDuration}):** phân chia rõ từng tiết (Tiết 1, Tiết 2, Tiết 3... ứng với hoạt động nào, bao nhiêu phút).
     * Soạn đầy đủ, chi tiết toàn bộ 4 chuỗi hoạt động:
       + HOẠT ĐỘNG 1: HOẠT ĐỘNG KHỞI ĐỘNG (... phút)
       + HOẠT ĐỘNG 2: HÌNH THÀNH KIẾN THỨC MỚI (... phút) -> Chia nhỏ mạch lạc thành Hoạt động 2.1, Hoạt động 2.2, Hoạt động 2.3... theo đúng các mục kiến thức trong SGK!
       + HOẠT ĐỘNG 3: LUYỆN TẬP (... phút) (Trắc nghiệm tương tác trên công cụ số + lời giải chi tiết các bài tập SGK)
       + HOẠT ĐỘNG 4: VẬN DỤNG (... phút) (Giải quyết bài toán thực tiễn có lời giải, kết luận số liệu trọn vẹn)
     * Mỗi hoạt động (kể cả từng Hoạt động 2.1, 2.2, 2.3...) ĐỀU PHẢI CÓ ĐỦ 4 MỤC:
       a. Mục tiêu: ...
       b. Nội dung: ... (Ghi rõ mã chỉ báo NLS tích hợp tại hoạt động đó trong thẻ [[RED:...]])
       c. Sản phẩm: ...
       d. Tổ chức thực hiện:
       Bảng 2 cột Markdown chuẩn:
       | HOẠT ĐỘNG CỦA GIÁO VIÊN VÀ HỌC SINH | SẢN PHẨM (YÊU CẦU CẦN ĐẠT) |
       | --- | --- |
       Bên cột trái trình bày rõ đủ **Bước 1: Chuyển giao nhiệm vụ**, **Bước 2: Thực hiện nhiệm vụ**, **Bước 3: Báo cáo, thảo luận**, **Bước 4: Kết luận, nhận định**. Bên cột phải trình bày ĐẦY ĐỦ định nghĩa, quy tắc, lời giải chi tiết từng ví dụ/luyện tập/bài tập SGK và CHÈN TRỰC TIẾP hình vẽ <svg> minh họa chuẩn toán học ngay trong cột sản phẩm!
   - IV. HƯỚNG DẪN VỀ NHÀ (... phút):
     1. Ôn tập kiến thức
     2. Bài tập về nhà
     3. Chuẩn bị bài mới
   - V. PHỤ LỤC:
     1. Các Phiếu học tập (chi tiết từng phiếu sử dụng trong bài)
     2. Bảng tiêu chí đánh giá (Rubric đánh giá hoạt động nhóm có tiêu chí ứng dụng công nghệ số [[RED:...]])

✦ F / O (Format / Output Format - Quy chuẩn bắt buộc):
1. TÔ ĐỎ NĂNG LỰC SỐ: Toàn bộ 100% nội dung liên quan trực tiếp đến năng lực số (mã chỉ báo, công cụ số, thao tác số của GV & HS) PHẢI bọc trong [[RED:...]] (chữ thường, không in đậm, đóng ]] đầy đủ).
2. ${mathAndFigurePromptBlock}

${mathTechnicalExecutionGuide}

${svgFigureTechnicalGuide}

3. QUY CHUẨN TRANG IN & CHÍNH TẢ:
   - Khổ A4; ${selectedMarginDesc}; Font ${selectedFont}, cỡ ${selectedPt}pt.
   - Tuyệt đối KHÔNG sử dụng chú thích ngoặc vuông rác dạng [...] hay [i].
   - Viết hoa đúng ngữ pháp tiếng Việt, không viết hoa tùy tiện từng từ (Title Case).
   - Không dùng thẻ <br> ở ngoài bảng; bên trong ô bảng dùng <br> để xuống dòng giữa các ý.`;

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

  const promptText = `Hãy biên soạn Kế hoạch bài dạy tích hợp năng lực số hoàn chỉnh đáp ứng chính xác MỌI thông số do giáo viên đã tích chọn dưới đây:

1. THÔNG TIN BÀI HỌC ĐÃ CHỌN:
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
    : "(Áp dụng Yêu cầu cần đạt chuẩn Chương trình GDPT 2018 của bài học, phân bổ chi tiết thời lượng từng tiết và hoạt động)"
}

3. CĂN CỨ PHỤ LỤC 3 & CÁC MÃ CHỈ BÁO NĂNG LỰC SỐ ĐÃ TÍCH CHỌN (BẮT BUỘC TÍCH HỢP ĐẦY ĐỦ 100% CÁC MÃ NÀY):
${payload.phuLuc3Text && payload.phuLuc3Text.trim() ? `* Trích từ Phụ lục 3:\n${payload.phuLuc3Text}\n` : ""}
* Danh sách mã chỉ báo năng lực số phải xuất hiện đầy đủ ở Mục tiêu (I.2) và phân bổ cụ thể vào các Hoạt động học (III):
${competenciesText}

4. THIẾT BỊ DẠY HỌC & PHẦN MỀM SỐ ĐÃ TÍCH CHỌN (PHẢI ĐƯA ĐẦY ĐỦ VÀO MỤC II VÀ CÁC BƯỚC HOẠT ĐỘNG):
* Thiết bị Giáo viên:
${teacherEqText}
* Thiết bị Học sinh:
${studentEqText}
* Phần mềm / Nền tảng số khai thác:
${toolsText}

${
  payload.sgkImages && payload.sgkImages.length > 0
    ? `5. TÀI LIỆU SGK ĐÍNH KÈM (${payload.sgkImages.length} tài liệu ảnh/PDF):
- Bám sát 100% định nghĩa, ví dụ, số liệu, hình vẽ và bài tập trong tài liệu SGK đính kèm.
- Có thể dùng [[IMAGE:1:Chú thích]] cho ảnh chụp SGK đính kèm HOẶC vẽ trực tiếp hình toán học/đồ thị bằng <svg> nét 1pt màu black rõ nét.\n`
    : ""
}
6. BÀI SOẠN MẪU / GIÁO ÁN GỐC CỦA GIÁO VIÊN:
${
  payload.oldLessonPlanText && payload.oldLessonPlanText.trim()
    ? payload.oldLessonPlanText
    : "(Biên soạn mới hoàn chỉnh theo chuẩn Giáo án mẫu tích hợp năng lực số Công văn 5512 với đầy đủ lời giải chi tiết, hình vẽ <svg> 1pt black trong cột Sản phẩm, Hướng dẫn về nhà và Phụ lục Phiếu học tập + Rubric)"
}

${payload.customNote ? `7. GHI CHÚ RIÊNG CỦA GIÁO VIÊN:\n${payload.customNote}\n` : ""}
8. YÊU CẦU TUYỆT ĐỐI VỀ CÔNG THỨC TOÁN HỌC VÀ HÌNH VẼ (TUÂN THỦ 100%):
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
  const cleaned = sanitizeLessonPlanOutput(raw, mathFormat);

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
1. TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT, KHÔNG RÚT GỌN, KHÔNG BỎ SÓT BẤT KỲ CÂU CHỮ, ĐOẠN VĂN HAY CÂU HỎI NÀO.
2. BẢO TỒN NGUYÊN VẸN CẤU TRÚC CHIA CỘT DƯỚI DẠNG BẢNG MARKDOWN (| Cột 1 | Cột 2 |):
   - Bảng 2 cột: | HOẠT ĐỘNG CỦA GV VÀ HS | SẢN PHẨM DỰ KIẾN |
     (Chứa đầy đủ: Bước 1, Bước 2, Bước 3, Bước 4; và cột sản phẩm tương ứng. Các đoạn văn bên trong ô cách nhau bằng thẻ <br>).
3. Toàn bộ các công thức toán học trích xuất sang LaTeX chuẩn trong $...$ hoặc $$...$$.
4. Ở các vị trí có tranh ảnh/sơ đồ/bản vẽ, đặt thẻ: [[IMAGE:hinh_x:Hình x. Chú thích hình ảnh]]
5. Trả về toàn văn bản Markdown hoàn chỉnh từ trang đầu đến trang cuối cùng.`,
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
