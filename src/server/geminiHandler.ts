import { GoogleGenAI } from "@google/genai";

const getGeminiClient = (userApiKey?: string) => {
  const envKey = typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : undefined;
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
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

export interface GenerateLessonPlanPayload {
  userApiKey?: string;
  userEmail?: string;
  userName?: string;
  subject: string;
  grade: string;
  lessonTitle: string;
  lessonDuration: string;
  curriculum?: string;
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
  oldLessonPlanText?: string; // Bài soạn gốc/mẫu của giáo viên nếu có
  sgkImages?: Array<{ mimeType: string; data: string; name?: string; id?: string }>;
  customNote?: string;
  phuLuc1Text?: string; // Kế hoạch dạy học của tổ chuyên môn (YCCD, phân bổ số tiết, thiết bị, phòng học...)
  phuLuc3Text?: string; // Kế hoạch giáo dục của giáo viên (mã năng lực số và phương án tổ chức bằng công cụ số...)
}

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
          // Wait briefly before retrying (1s, then 2s)
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        } else {
          // If it's another non-demand error (e.g. invalid key format), don't retry same model
          break;
        }
      }
    }
  }

  // If all candidate models were unavailable due to global high demand
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
        'User-Agent': 'aistudio-build',
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

export function sanitizeLessonPlanOutput(text: string): string {
  if (!text) return "";

  // Normalize case-insensitivity and spacing for [[RED:
  let normalized = text.replace(/\[\[\s*red\s*:/gi, "[[RED:");

  // 1. Normalize multi-line [[RED:...]] tags across newlines and <br>
  normalized = normalized.replace(/\[\[RED:([\s\S]*?)\]\]/gi, (_, inner) => {
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

  // Auto-close any unclosed [[RED:... that might exist on lines
  const rawLines = normalized.split("\n");
  const preprocessedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Inside table row: normalize <br>- or <br>– 
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
    .map(line => {
      let l = line.trimEnd();

      // Remove any stray <br> tags outside tables
      if (!l.startsWith("|") || !l.endsWith("|")) {
        l = l.replace(/&lt;br\s*\/?&gt;\s*[-–]?\s*/gi, " ");
        l = l.replace(/<br\s*\/?>\s*[-–]?\s*/gi, " ");
        l = l.replace(/&lt;br\s*\/?&gt;/gi, "");
        l = l.replace(/<br\s*\/?>/gi, "");
      }

      // 1. Remove leading '.' or '*' or '*.' before roman numerals, numbers, headings, letters, or activity names
      l = l.replace(/^[\s*.]+(?=[I|V|XLCDM]+\b[\.\:\s])/i, "");
      l = l.replace(/^[\s*.]+(?=\d+[\.\)\:\s])/i, "");
      l = l.replace(/^[\s*.]+(?=[a-z]\)[\s])/i, "");
      l = l.replace(/^[\s*.]+(?=(?:Hoạt động|HOẠT ĐỘNG|MỤC TIÊU|Mục tiêu|TIẾN TRÌNH|Tiến trình|THIẾT BỊ|Thiết bị|HỒ SƠ|Hồ sơ)[\s\:\.])/i, "");

      // 2. Remove markdown asterisks wrapper around headings like **I. MỤC TIÊU**
      l = l.replace(/^\*\*(.*?)\*\*$/, "$1");

      // 3. Remove leading stray '*' or '.' before headings
      l = l.replace(/^[\s*.]+\*\*(.*?)\*\*/, "$1");

      // 4. Remove '*' at the end of sentences or lines (e.g. "...thực hiện.*" -> "...thực hiện.")
      l = l.replace(/\*+\s*([.,;:!?])/g, "$1");
      l = l.replace(/([.,;:!?])\*+\s*$/g, "$1");
      l = l.replace(/\*+\s*$/g, "");

      // 5. Clean inside [[RED:...]] tags so they are only red, not bold, and have no asterisks
      l = l.replace(/\[\[\s*red\s*:/gi, "[[RED:");
      l = l.replace(/\[\[RED:\s*\*\*(.*?)\*\*\s*\]\]/gi, "[[RED:$1]]");
      l = l.replace(/\[\[RED:\s*\*(.*?)\*\s*\]\]/gi, "[[RED:$1]]");
      l = l.replace(/\[\[RED:(.*?)\*+\]\]/gi, "[[RED:$1]]");

      // Ensure any unclosed [[RED: in this line is closed
      const opens = (l.match(/\[\[RED:/g) || []).length;
      const closes = (l.match(/\]\]/g) || []).length;
      if (opens > closes) {
        l += "]]".repeat(opens - closes);
      }

      // Sanitize unclosed inline math $ in line if there's an odd number of $
      const dollarCount = (l.match(/(?<!\\)\$/g) || []).length;
      if (dollarCount % 2 !== 0 && !l.includes("$$")) {
        l += "$";
      }

      // 6. Fix arbitrary Title Case capitalization on common headings and steps
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
    })
    .join("\n");

  // Safeguard: detect if "d) Tổ chức thực hiện:" of Hoạt động 2 was left empty before Hoạt động 3
  const emptyHĐ2Regex = /(d\)\s*Tổ chức thực hiện:\s*)(?=(?:3\.\s*Hoạt động luyện tập|Hoạt động 3\s*:?\s*Luyện tập|###\s*3\.\s*Hoạt động luyện tập|###\s*Hoạt động 3|HOẠT ĐỘNG 3))/i;
  if (emptyHĐ2Regex.test(processed)) {
    const defaultHĐ2Implementation = `d) Tổ chức thực hiện:
| Hoạt động của GV và HS | Sản phẩm dự kiến |
| --- | --- |
| **Bước 1: GV chuyển giao nhiệm vụ:**<br>– GV yêu cầu học sinh nghiên cứu nội dung SGK, quan sát tranh ảnh/học liệu và thảo luận nhóm hoàn thành nhiệm vụ học tập.<br>[[RED:– GV trình chiếu học liệu số, phần mềm hoặc mô hình tương tác trên Smart TV/máy chiếu để học sinh quan sát và thao tác trực quan.]]<br><br>**Bước 2: HS thực hiện nhiệm vụ học tập:**<br>– Các nhóm học sinh đọc SGK, thảo luận tích cực và ghi nhận kết quả vào phiếu học tập.<br>[[RED:– HS sử dụng thiết bị số (máy tính, điện thoại, máy tính bảng) khai thác phần mềm chuyên dụng hoặc học liệu số để giải quyết nhiệm vụ.]]<br>– GV quan sát, theo dõi và hỗ trợ kịp thời.<br><br>**Bước 3: Báo cáo kết quả hoạt động, thảo luận:**<br>– Đại diện nhóm lên trình bày kết quả, các nhóm khác chú ý lắng nghe, đối chiếu kết quả, đặt câu hỏi phản biện và bổ sung ý kiến.<br><br>**Bước 4: Đánh giá kết quả thực hiện:**<br>– GV nhận xét tinh thần làm việc của các nhóm và chuẩn hóa kiến thức trọng tâm bài học.<br>[[RED:[Tích hợp năng lực số: HS sử dụng thành thạo công cụ số và thiết bị số để thu thập thông tin, mô phỏng và hoàn thành xuất sắc nhiệm vụ học tập.]]] | **SẢN PHẨM HỌC TẬP DỰ KIẾN:**<br>– Kết quả hoàn thành các câu hỏi, bài tập và phiếu học tập được chuẩn hóa đầy đủ và chính xác theo yêu cầu cần đạt. |

`;
    processed = processed.replace(emptyHĐ2Regex, defaultHĐ2Implementation);
  }

  return processed;
}

export async function handleGenerateLessonPlan(payload: GenerateLessonPlanPayload) {
  // If userApiKey is provided, use user's personal quota
  const ai = getGeminiClient(payload.userApiKey);

  const competenciesText = payload.digitalCompetencies && payload.digitalCompetencies.length > 0
    ? payload.digitalCompetencies
        .map(c => `- MÃ CHỈ BÁO [${c.code}] (${c.domain || 'Năng lực số'})${c.isCustom ? ' [DO GIÁO VIÊN TỰ DÁN/ĐỊNH NGHĨA]' : ''}:
    + Yêu cầu cần đạt (YCCD): ${c.yccd || c.title || c.description}
    + Diễn giải cụ thể: ${c.fullExplanation || c.description || c.title}${c.suggestedTools ? `\n    + Công cụ/thiết bị: ${c.suggestedTools}` : ''}`)
        .join("\n\n")
    : "Tự động phân bổ các chỉ báo năng lực số thiết yếu phù hợp nhất với bài học theo văn bản 3456/BGDĐT-GDPT.";

  const teacherEqText = payload.teacherEquipment && payload.teacherEquipment.length > 0
    ? payload.teacherEquipment.map(e => `- ${e.name}: ${e.quantity}${e.note ? ` (${e.note})` : ''}`).join("\n")
    : "Laptop giáo viên, Smart TV / Máy chiếu, kết nối Internet tốc độ cao.";

  const studentEqText = payload.studentEquipment && payload.studentEquipment.length > 0
    ? payload.studentEquipment.map(e => `- ${e.name}: ${e.quantity}${e.note ? ` (${e.note})` : ''}`).join("\n")
    : "Điện thoại thông minh / máy tính bảng theo nhóm, SGK, vở ghi.";

  const toolsText = payload.digitalTools && payload.digitalTools.length > 0
    ? payload.digitalTools.join(", ")
    : "Padlet, Quizizz, Canva, Google Drive.";

  const sgkImageListText = payload.sgkImages && payload.sgkImages.length > 0
    ? payload.sgkImages.map((img, i) => `- Hình ảnh ${i + 1}: ${img.name || `Trang/Hình ảnh SGK ${i + 1}`}`).join("\n")
    : "";

  const systemInstruction = `✦ R (Role - Vai trò) - Gán vai chuyên gia:
Bạn là giáo viên chuyên môn môn ${payload.subject}, lớp ${payload.grade} có nhiều năm kinh nghiệm, am hiểu sâu sắc Chương trình GDPT 2018, Công văn 5512/BGDĐT-GDTrH và phương pháp dạy học phát triển phẩm chất, năng lực học sinh. Đồng thời, bạn là chuyên gia tích hợp công nghệ và năng lực số trong giáo dục.

✦ T (Task - Nhiệm vụ) - Chỉ định sản phẩm chính:
Hãy biên soạn Kế hoạch bài dạy (Giáo án) hoàn chỉnh cho bài: "${payload.lessonTitle}" (Thời lượng: ${payload.lessonDuration}) và xuất thành file Word (.docx) dùng được ngay trên lớp theo chuẩn Công văn 5512/BGDĐT.

✦ C (Context - Bối cảnh & Căn cứ 4 Nguồn Tài liệu - Gemini Notebook):
1. Nguồn 1: Mẫu giáo án / Bài soạn gốc (nếu có cung cấp, bạn PHẢI BẢO TOÀN NGUYÊN VĂN 100% cấu trúc, nội dung, bảng biểu, câu hỏi, bài tập, hình ảnh).
2. Nguồn 2: Tài liệu SGK bài học (${payload.subject} ${payload.grade}): Dùng để đối chiếu thuật ngữ, số liệu, định nghĩa, bài tập, câu hỏi; đảm bảo bài soạn chuẩn xác 100% so với SGK. Tuyệt đối không chèn ảnh chụp trang SGK vào bài soạn.
3. Nguồn 3: Phụ lục 1 (Kế hoạch dạy học của tổ chuyên môn): Tra cứu kỹ để lấy đúng Yêu cầu cần đạt (YCCD), phân bổ chi tiết thời lượng ${payload.lessonDuration} theo từng tiết (Tiết 1, Tiết 2, Tiết 3...), thiết bị dạy học, học liệu số và phòng học bộ môn.
4. Nguồn 4: Phụ lục 3 (Kế hoạch giáo dục của giáo viên): Tra cứu các mã chỉ báo năng lực số và phương án tổ chức dạy học bằng công cụ số tương ứng.
5. Cấu trúc tổ chức: Bám sát sách giáo khoa, tuân thủ cấu trúc 4 bước tổ chức hoạt động học theo Mẫu giáo án và Công văn 5512 (Bước 1: GV chuyển giao nhiệm vụ -> Bước 2: HS thực hiện nhiệm vụ -> Bước 3: Báo cáo, thảo luận -> Bước 4: Đánh giá, kết luận) dạng bảng 2 cột (| Hoạt động của GV và HS | Sản phẩm dự kiến |).
6. Soạn đầy đủ tiến trình cả ${payload.lessonDuration}: Nếu thời lượng là nhiều tiết (ví dụ: 2 tiết, 3 tiết, 4 tiết...), bạn BẮT BUỘC phân chia rõ ràng ranh giới các tiết dạy: "TIẾT 1: ...", "TIẾT 2: ...", "TIẾT 3: ..." với các hoạt động tương ứng. Tuyệt đối KHÔNG được tóm tắt hay rút gọn!
7. Trích cắt hình minh họa: Mọi thẻ [[IMAGE:...]] có sẵn trong bài soạn gốc hoặc SGK phải được giữ nguyên tại đúng vị trí cột/ô hoạt động tương ứng.

✦ F / O (Format / Output Format - Định dạng đầu ra) - Quy chuẩn kỹ thuật & hiển thị:
1. TÍCH HỢP NĂNG LỰC SỐ:
   - Tích hợp logic, bài bản, gắn liền với thiết bị số và công cụ số thực tế (như Quizizz, Padlet, GeoGebra, Desmos, Canva, Google Drive, AI tools...).
   - YÊU CẦU ĐẶC BIỆT: Toàn bộ nội dung liên quan trực tiếp đến năng lực số (câu từ, hướng dẫn, thao tác học sinh/giáo viên và mã chỉ báo) PHẢI ĐƯỢC TÔ CHỮ MÀU ĐỎ bằng cú pháp [[RED:...]] (chữ thường, không in đậm, đóng ngoặc ]] đầy đủ).
   - PHỤ LỤC BẮT BUỘC Ở CUỐI GIÁO ÁN: Cuối giáo án PHẢI tạo mục "## IV. PHỤ LỤC" gồm:
     * 1. CÁC PHIẾU HỌC TẬP: Thiết kế đầy đủ, chi tiết toàn bộ các Phiếu học tập (Phiếu 1, Phiếu 2, Phiếu 3...) đã sử dụng trong các hoạt động học của bài dạy. Mỗi phiếu có bảng biểu rõ ràng gồm: Tên phiếu, Mục tiêu, Tên nhóm/HS, Nhiệm vụ/câu hỏi/bài tập, và Phần dòng kẻ/khoảng trống dự kiến cho học sinh làm bài.
     * 2. BẢNG TIÊU CHÍ ĐÁNH GIÁ (RUBRIC ĐÁNH GIÁ HOẠT ĐỘNG NHÓM): Bảng tiêu chí chuẩn mực dạng Markdown gồm các cột: Tiêu chí đánh giá, Mức 1 (Chưa đạt), Mức 2 (Đạt), Mức 3 (Tốt), Điểm tối đa. Bao gồm tiêu chí về tinh thần hợp tác, ứng dụng công cụ số [[RED:...]], chất lượng sản phẩm và kỹ năng thuyết trình.
2. CHUẨN HÓA CÔNG THỨC TOÁN HỌC / KÝ HIỆU KHOA HỌC:
   - 100% công thức, biểu thức, ký hiệu và số liệu mang ý nghĩa toán học/khoa học trong toàn bộ giáo án PHẢI ĐƯỢC VIẾT DƯỚI DẠNG CÚ PHÁP LATEX đặt trong '$ ... $' (trong dòng) hoặc '$$ ... $$' (dòng riêng).
   - Áp dụng cho MỌI phần: kiến thức, ví dụ, bài tập, lời giải, đáp án, bảng biểu, tọa độ, hệ bất phương trình/hệ phương trình và các cột hoạt động.
   - Ví dụ:
     * Hệ bất phương trình: '$$\\begin{cases} 2x + y \\le 4 \\\\ x - y > 1 \\\\ x \\ge 0 \\end{cases}$$'
     * Tọa độ: '$A(0; 4)$', '$B(1; 2)$', '$C(3; 0)$'
     * Biểu thức: '$F(x, y) = 2x + 3y$', '$x + y \\ge 2$'
     * Ký hiệu: '$\\Delta$', '$\\le$', '$\\ge$', '$\\neq$', '$\\in$', '$\\subset$', '$\\cup$', '$\\cap$'
   - Tuyệt đối KHÔNG viết công thức bằng văn bản thường không có dấu $, không dùng ký tự giả lập hoặc hình ảnh.
3. QUY CHUẨN TRANG IN & CHÍNH TẢ TIẾNG VIỆT:
   - Khổ A4; lề trái 2,5 cm, các lề còn lại 1,5 cm; Font Times New Roman, cỡ 13, giãn dòng đơn.
   - Tuyệt đối KHÔNG sử dụng chú thích ngoặc vuông dạng [...] hay [i].
   - Viết hoa đúng ngữ pháp tiếng Việt: Chỉ viết hoa chữ cái đầu câu/đầu tiêu đề và các danh từ riêng theo đúng ngữ pháp chính tả tiếng Việt. Tuyệt đối KHÔNG viết hoa tùy tiện từng chữ (Title Case).
   - Tuyệt đối KHÔNG dùng ký tự '*' hay dấu '.' trước các đề mục. Không dùng '*' ở cuối câu.
   - Tuyệt đối KHÔNG dùng thẻ HTML <br> hay <br>- ở ngoài bảng. Xuống dòng bằng phím Enter bình thường.
   - Tuyệt đối KHÔNG để sót các ký hiệu thô rác: '<br>-', '<br>', '&lt;br&gt;', '[[RED:', ']]'.`;

  const promptParts: any[] = [];

  // Add textbook photos or PDF files if uploaded (strictly for reference & verification)
  if (payload.sgkImages && payload.sgkImages.length > 0) {
    for (const img of payload.sgkImages) {
      const isPdf = img.mimeType === "application/pdf" || (img.data && img.data.startsWith("JVBER"));
      promptParts.push({
        inlineData: {
          mimeType: isPdf ? "application/pdf" : (img.mimeType || "image/jpeg"),
          data: img.data,
        },
      });
    }
  }

  const promptText = `
✦ R (Role - Vai trò):
Bạn là giáo viên chuyên môn ${payload.subject} ${payload.grade} có nhiều năm kinh nghiệm, am hiểu sâu sắc Chương trình GDPT 2018 (CV 5512/BGDĐT-GDTrH).

✦ T (Task - Nhiệm vụ):
Biên soạn Kế hoạch bài dạy (Giáo án) hoàn chỉnh cho bài: "${payload.lessonTitle}" (Thời lượng: ${payload.lessonDuration}) và xuất thành file Word (.docx) dùng được ngay trên lớp.

✦ C (Context - Bối cảnh & Căn cứ 4 Nguồn Tài liệu):
${payload.userEmail ? `(Giáo viên thực hiện: ${payload.userName || 'Thầy/Cô'} - Gmail: ${payload.userEmail})` : ''}

1. THÔNG TIN BÀI HỌC:
- Môn học / Hoạt động giáo dục: ${payload.subject}
- Khối lớp: ${payload.grade}
- Tên bài dạy: ${payload.lessonTitle}
- Thời lượng: ${payload.lessonDuration}
- Bộ sách giáo khoa: ${payload.curriculum || "Chương trình GDPT 2018"}

2. CĂN CỨ PHỤ LỤC 1 (KẾ HOẠCH DẠY HỌC CỦA TỔ CHUYÊN MÔN):
${payload.phuLuc1Text && payload.phuLuc1Text.trim() ? payload.phuLuc1Text : "(Sử dụng Yêu cầu cần đạt chuẩn, phân bổ số tiết theo từng tiết, thiết bị dạy học, học liệu số và phòng học theo quy định bộ môn)"}

3. CĂN CỨ PHỤ LỤC 3 (KẾ HOẠCH GIÁO DỤC CỦA GIÁO VIÊN VỀ NĂNG LỰC SỐ) & DANH SÁCH CHỈ BÁO NLS:
${payload.phuLuc3Text && payload.phuLuc3Text.trim() ? `* Trích từ Phụ lục 3 của giáo viên:\n${payload.phuLuc3Text}\n` : ''}
* Danh sách chỉ báo năng lực số đăng ký tích hợp:
${competenciesText}

4. HỌC LIỆU SỐ, THIẾT BỊ SỐ & PHÒNG HỌC ĐÁP ỨNG ĐƯỢC:
* Giáo viên chuẩn bị:
${teacherEqText}

* Học sinh chuẩn bị (theo nhóm / cá nhân):
${studentEqText}

* Công cụ / Ứng dụng số khai thác:
${toolsText}

${payload.sgkImages && payload.sgkImages.length > 0 ? `5. TÀI LIỆU NỘI DUNG BÀI HỌC SGK ĐÍNH KÈM (ẢNH CHỤP HOẶC TỆP PDF - ${payload.sgkImages.length} tài liệu):
=> Bám sát toàn bộ thuật ngữ, nội dung cốt lõi, bảng số liệu, hình minh họa và câu hỏi trong SGK để biên soạn giáo án chuẩn xác 100%, không bị sai lệch so với SGK.
=> CHÈN HÌNH MINH HỌA: Nếu tài liệu đính kèm có hình minh họa, hình vẽ hình học, đồ thị tọa độ hoặc sơ đồ trực quan dùng trong các hoạt động học, hãy chèn thẻ [[IMAGE:1:Hình 1. Chú thích hình]], [[IMAGE:2:Hình 2. Chú thích hình]]... (với số 1, 2... là thứ tự tài liệu đính kèm) vào đúng vị trí hoặc cột bảng của hoạt động tương ứng để hệ thống xuất Word nhúng ảnh thực tế.\n` : ''}

6. BÀI SOẠN MẪU / GIÁO ÁN GỐC CỦA GIÁO VIÊN:
${payload.oldLessonPlanText && payload.oldLessonPlanText.trim() ? payload.oldLessonPlanText : "(Chưa có văn bản bài soạn cũ, hãy xây dựng bài dạy mới hoàn chỉnh theo chuẩn CV 5512 với đầy đủ tiến trình các tiết và mục Phụ lục ở cuối)"}

${payload.customNote ? `7. GHI CHÚ THÊM CỦA GIÁO VIÊN:\n${payload.customNote}\n` : ''}

✦ F / O (Format / Output Format - Quy chuẩn kỹ thuật & hiển thị):
- Soạn đầy đủ tiến trình cả ${payload.lessonDuration} (nếu từ 2 tiết trở lên, phân bổ rõ ràng ranh giới TIẾT 1, TIẾT 2, TIẾT 3... với các hoạt động tương ứng).
- Mỗi hoạt động đều có Bảng 2 cột (| Hoạt động của GV và HS | Sản phẩm dự kiến |) đủ 4 bước (Bước 1, Bước 2, Bước 3, Bước 4).
- Bôi đỏ 100% các nội dung năng lực số bằng [[RED:...]] (chữ thường, không in đậm).
- Khi có tài liệu SGK đính kèm, chèn thẻ [[IMAGE:x:Tên hình]] vào đúng hoạt động học để giáo án có hình ảnh minh họa trực quan.
- Bắt buộc tạo mục ## IV. PHỤ LỤC ở cuối bài gồm: Các Phiếu học tập số 1, 2, 3... và Bảng Rubric đánh giá hoạt động nhóm.
- 100% công thức, biểu thức, tọa độ, hệ bất phương trình/hệ phương trình phải viết dạng LaTeX trong $...$ hoặc $$...$$.
- Khổ A4, lề trái 2.5cm, các lề còn lại 1.5cm, Times New Roman 13pt. Không ký tự rác [...] hay [i].`;

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
  const cleaned = sanitizeLessonPlanOutput(raw);

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
     (Chứa đầy đủ: Bước 1: GV chuyển giao nhiệm vụ, Bước 2: HS thực hiện, Bước 3: Báo cáo thảo luận, Bước 4: Đánh giá; và cột sản phẩm tương ứng. Các đoạn văn bên trong ô cách nhau bằng thẻ <br>).
   - Bảng 3 cột: | Trình tự đọc | Nội dung | Thông tin chi tiết ... |
   - Bảng đáp án trắc nghiệm: | Câu 1 | Câu 2 | Câu 3 | Câu 4 | Câu 5 |
3. Toàn bộ các câu hỏi trắc nghiệm (ví dụ: Câu 1, Câu 2, Câu 3, Câu 4, Câu 5 kèm đầy đủ 4 phương án A, B, C, D) phải được giữ nguyên từng chữ.
4. Ở các vị trí có tranh ảnh/sơ đồ/bản vẽ (ví dụ: Hình 3.1, Hình 3.2, Hình 3.3, Hình 3.6...), đặt thẻ:
   [[IMAGE:hinh_x:Hình x. Chú thích hình ảnh]]
5. Trả về toàn văn bản Markdown hoàn chỉnh từ trang đầu đến trang cuối cùng.`
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
        mimeType: isPdf ? "application/pdf" : (img.mimeType || "image/jpeg"),
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
4. Danh sách các hình minh họa, biểu đồ, bản vẽ, bảng số liệu, thí nghiệm hoặc hoạt động khám phá trong SGK.
5. Tiến trình hoạt động học trong SGK (Khởi động, Khám phá/Hình thành kiến thức, Luyện tập, Vận dụng).
6. Đề xuất các hoạt động tích hợp năng lực số (NLS) phù hợp nhất với nội dung bài học (ví dụ: công cụ tìm kiếm dữ liệu, GeoGebra/Desmos, Quizizz/Padlet, ứng dụng AI...).
Trả về ngắn gọn, sư phạm, chuyên nghiệp bằng tiếng Việt để giáo viên tham khảo và tích hợp vào giáo án.`
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
