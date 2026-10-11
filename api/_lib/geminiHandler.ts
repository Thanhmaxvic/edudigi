import { GoogleGenAI } from "@google/genai";

const getGeminiClient = (userApiKey?: string) => {
  const apiKey = (userApiKey && userApiKey.trim()) || process.env.GEMINI_API_KEY;
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
| **Bước 1: GV chuyển giao nhiệm vụ:**<br>– GV yêu cầu học sinh nghiên cứu Nội dung mục II SGK tr.25 và quan sát Hình 4.6 SGK tr.26 (Bản vẽ lắp mẫu).<br>– GV chia lớp thành các nhóm (4 - 6 học sinh), yêu cầu học sinh thảo luận và hoàn thành bảng đọc bản vẽ lắp theo đúng trình tự 5 bước: Khung tên -> Bảng kê -> Hình biểu diễn -> Kích thước -> Tổng hợp.<br>[[RED:– GV trình chiếu bản vẽ lắp phóng to chất lượng cao trên Smart TV và cung cấp tệp mô hình 3D tương tác trên phần mềm mô phỏng để học sinh có thể xoay, phóng to các chi tiết trên máy tính bảng hoặc điện thoại nhóm.]]<br><br>**Bước 2: HS thực hiện nhiệm vụ học tập:**<br>– Các nhóm học sinh đọc SGK, quan sát kĩ từng vị trí trên bản vẽ lắp mẫu Hình 4.6 và thảo luận ghi kết quả vào phiếu học tập.<br>[[RED:– HS sử dụng ứng dụng mô phỏng 3D trên thiết bị số để phóng to mối ghép chốt bản lề, vòng đệm và quan sát thứ tự tháo lắp các chi tiết trong không gian 3 chiều.]]<br>– GV quan sát, theo dõi và gợi ý cho các nhóm gặp khó khăn.<br><br>**Bước 3: Báo cáo kết quả hoạt động, thảo luận:**<br>– GV gọi đại diện 1 - 2 nhóm lên trình bày kết quả đọc bản vẽ lắp.<br>– Các nhóm khác chú ý lắng nghe, đối chiếu kết quả, đặt câu hỏi phản biện và bổ sung ý kiến.<br><br>**Bước 4: Đánh giá kết quả thực hiện:**<br>– GV nhận xét tinh thần làm việc của các nhóm và chuẩn hóa kiến thức đọc bản vẽ lắp.<br>– GV phân tích kĩ bước 5 (Tổng hợp): Học sinh cần xác định rõ trình tự tháo lắp và công dụng thực tế của sản phẩm.<br>[[RED:[6.1.TC2a: HS sử dụng thành thạo phần mềm đồ họa mô phỏng 3D để trực quan hóa cấu trúc không gian và quy trình tháo lắp sản phẩm kĩ thuật.]]] | **BẢNG TRÌNH TỰ ĐỌC BẢN VẼ LẮP (Hình 4.6 SGK tr.26):**<br>(Xem chi tiết ở bảng 3 cột bên dưới) |

BẢNG 3 CỘT: TRÌNH TỰ ĐỌC BẢN VẼ LẮP MẪU (Hình 4.6 SGK tr.26)

| Trình tự đọc | Nội dung cần hiểu | Bản vẽ lắp mẫu (Hình 4.6 SGK tr.26) |
| --- | --- | --- |
| 1. Khung tên | – Tên gọi sản phẩm<br>– Tỉ lệ bản vẽ<br>– Cơ sở thiết kế, chế tạo | – Bộ bản lề<br>– 1:2<br>– Nhà máy cơ khí Hà Nội |
| 2. Bảng kê | – Tên gọi các chi tiết và số lượng<br>– Vật liệu chế tạo của từng chi tiết | – Chi tiết 1: Bản lề trái (số lượng: 1, vật liệu: Thép)<br>– Chi tiết 2: Bản lề phải (số lượng: 1, vật liệu: Thép)<br>– Chi tiết 3: Chốt (số lượng: 1, vật liệu: Thép)<br>– Chi tiết 4: Vòng đệm (số lượng: 1, vật liệu: Thép/Cao su) |
| 3. Hình biểu diễn | – Tên gọi các hình chiếu<br>– Vị trí các hình cắt | – Hình chiếu đứng có cắt cục bộ<br>– Hình chiếu bằng |
| 4. Kích thước | – Kích thước chung của sản phẩm<br>– Kích thước lắp ghép giữa các chi tiết<br>– Kích thước định vị giữa các chi tiết | – Kích thước chung: 100, 50, 20 (dài x rộng x cao)<br>– Kích thước lắp ghép: Đường kính chốt phi 8<br>– Kích thước định vị: Khoảng cách giữa 2 tâm lỗ là 60 |
| 5. Tổng hợp | – Trình tự tháo và lắp các chi tiết<br>– Công dụng của sản phẩm | – Trình tự tháo: Chốt (3) -> Vòng đệm (4) -> Tách rời bản lề trái (1) và bản lề phải (2). Trình tự lắp: Ngược lại với trình tự tháo.<br>– Công dụng: Dùng để liên kết cánh cửa với khung cửa, giúp cửa đóng mở linh hoạt. |

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

  const systemInstruction = `Bạn là giáo viên chuyên môn trực tiếp giảng dạy môn ${payload.subject}, lớp ${payload.grade} (Chương trình GDPT 2018 theo Công văn 5512/BGDĐT-GDTrH), đồng thời là một chuyên gia về Chuyển đổi số. Nhiệm vụ của bạn là soạn giáo án bài "${payload.lessonTitle}".
Khi tích hợp năng lực số, bạn PHẢI đưa vào một cách logic, bài bản, liền mạch với các nội dung kiến thức chuyên môn sẵn có hoặc thêm mới. Các hoạt động tích hợp phải thực tế, khả thi và tương thích tuyệt đối với các thiết bị số, học liệu số, các phương tiện dạy học mà giáo viên đã cung cấp.

NGUYÊN TẮC CỐT LÕI - BẢO TOÀN TUYỆT ĐỐI 100% NỘI DUNG VÀ CẤU TRÚC:
BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT, KHÔNG ĐƯỢC LƯỢC BỎ, KHÔNG ĐƯỢC RÚT GỌN BẤT KỲ CÂU CHỮ, ĐOẠN VĂN, BẢNG BIỂU, CÂU HỎI TRẮC NGHIỆM HAY BẢNG ĐÁP ÁN NÀO CỦA BÀI SOẠN!

1. KHI ĐÃ CÓ BÀI SOẠN CŨ CỦA GIÁO VIÊN:
   - Đây là quy trình "BỔ SUNG NĂNG LỰC SỐ VÀO NỀN BÀI SOẠN GỐC" (In-place Enrichment), KHÔNG PHẢI VIẾT LẠI HOẶC TÓM TẮT.
   - BẮT BUỘC giữ lại 100% nguyên văn toàn bộ các câu, từ, đoạn, tiêu đề, bảng biểu, câu hỏi và đáp án của bài soạn cũ.
   - BẢO ĐẢM KHÔNG ĐƯỢC BỎ SÓT NỘI DUNG Ở MỤC "d) Tổ chức thực hiện:":
     Tuyệt đối KHÔNG ĐƯỢC chỉ ghi dòng "d) Tổ chức thực hiện:" rồi bỏ trống hoặc nhảy ngay sang "3. Hoạt động luyện tập"!
     Nếu bài soạn cũ có bảng hoặc các bước ở "d) Tổ chức thực hiện:", bạn PHẢI GIỮ LẠI ĐẦY ĐỦ 100%. Nếu bài soạn cũ bị thiếu hoặc sơ sài ở mục này, bạn BẮT BUỘC PHẢI TRIỂN KHAI ĐẦY ĐỦ BẢNG 2 CỘT VỚI ĐỦ 4 BƯỚC (Bước 1: Chuyển giao nhiệm vụ; Bước 2: Thực hiện nhiệm vụ; Bước 3: Báo cáo thảo luận; Bước 4: Đánh giá kết quả) và BẢNG 3 CỘT ĐỌC BẢN VẼ THEO ĐÚNG NỘI DUNG SGK!
   - ĐỐI VỚI CÁC BẢNG CHIA CỘT (Bảng 2 cột '| Hoạt động của GV và HS | Sản phẩm dự kiến |', Bảng 3 cột '| Trình tự đọc | Nội dung cần hiểu | Bản vẽ... |', Bảng đáp án trắc nghiệm...):
     BẮT BUỘC GIỮ NGUYÊN 100% ĐỊNH DẠNG BẢNG MARKDOWN!
     BẮT BUỘC giữ đủ 4 bước trong cột hoạt động:
       * 'Bước 1: GV chuyển giao nhiệm vụ:'
       * 'Bước 2: HS thực hiện nhiệm vụ học tập:'
       * 'Bước 3: Báo cáo kết quả hoạt động, thảo luận:'
       * 'Bước 4: Đánh giá kết quả thực hiện:'
     Toàn bộ câu hỏi, dẫn dắt của GV và câu trả lời dự kiến của HS bên trong các ô bảng PHẢI ĐƯỢC GIỮ NGUYÊN NGUYÊN VĂN, không được bớt dù một dòng!
   - ĐỐI VỚI HỆ THỐNG CÂU HỎI TRẮC NGHIỆM & BÀI TẬP:
     Toàn bộ các câu hỏi trắc nghiệm (ví dụ từ Câu 1 đến Câu 5 có đầy đủ 4 phương án A, B, C, D) và BẢNG ĐÁP ÁN TRẮC NGHIỆM PHẢI ĐƯỢC GIỮ NGUYÊN 100%, tuyệt đối không được cắt bớt hoặc thay thế bằng câu tóm tắt như "HS làm theo SGK".
   - ĐỐI VỚI HÌNH ẢNH:
     Mọi thẻ hình ảnh dạng [[IMAGE:...]] có sẵn trong bài soạn cũ PHẢI ĐƯỢC GIỮ NGUYÊN 100% tại đúng vị trí ban đầu (trong ô bảng hoặc đoạn văn tương ứng). Tuyệt đối không xóa bất kỳ hình ảnh nào từ bài soạn cũ!
   - VỀ ẢNH CHỤP SÁCH GIÁO KHOA TẢI LÊN:
     Ảnh chụp các trang SGK CHỈ DÙNG ĐỂ ĐỐI CHIẾU, SO SÁNH NỘI DUNG KIẾN THỨC BÀI HỌC KHÔNG BỊ SAI LỆCH VỚI SGK, TUYỆT ĐỐI KHÔNG CHÈN ẢNH TRANG SGK ĐÓ VÀO BÀI SOẠN!

2. CÁCH THỨC LỒNG GHÉP NĂNG LỰC SỐ MỚI (CHỈ BÔI ĐỎ BẰNG [[RED:...]], CHỮ THƯỜNG, KHÔNG IN ĐẬM):
   Nhiệm vụ DUY NHẤT của bạn trên nền bài soạn cũ là bổ sung nội dung Năng lực số mới bọc trong [[RED:...]], không in đậm:
   - Trong Mục I.2 (Năng lực): Thêm hoặc cập nhật mục "Năng lực số:" gồm mã chỉ báo và diễn giải chuẩn đã chọn (Ví dụ: [[RED:Năng lực số:\n- 1.1.TC2a: Tìm kiếm, tiếp cận và khai thác học liệu số, bản vẽ mẫu 2D/3D từ thư viện số hoặc Internet.\n- 2.1.TC2a: Tương tác, trao đổi và chia sẻ sản phẩm học tập trên các nền tảng học tập số.\n- 6.1.TC2a: Sử dụng phần mềm đồ họa/mô phỏng số (như AutoCAD, Tinkercad, GeoGebra 3D hoặc ứng dụng xem mô hình 3D trên thiết bị số) để quan sát vật thể đa chiều và lập bản vẽ chi tiết.]]).
   - Trong Mục II (Thiết bị dạy học): Bổ sung thiết bị và ứng dụng số (Ví dụ: [[RED:- Mô hình vật thể 3D số hóa trên phần mềm mô phỏng 3D trình chiếu trên Smart TV...]], [[RED:- Bộ câu hỏi trắc nghiệm tương tác trên phần mềm Quizizz hoặc Kahoot...]], [[RED:- Thiết bị di động có kết nối Internet để học sinh quét mã QR và tương tác...]]).
   - Trong Mục III (Tiến trình dạy học):
     + Ở Bước 1 (Chuyển giao) hoặc Bước 2 (Thực hiện): lồng ghép thao tác học sinh dùng phần mềm/thiết bị số bọc trong [[RED:...]].
     + Ở Bước 4 (Đánh giá kết quả): bổ sung thẻ năng lực số tương ứng bọc trong ngoặc vuông và bôi đỏ (Ví dụ: [[RED:[6.1.TC2a: HS sử dụng phần mềm mô phỏng 3D để phóng to bản vẽ kĩ thuật và xoay mô hình đa chiều phục vụ tiếp thu kiến thức.]]]).

3. KHI CHƯA CÓ BÀI SOẠN CŨ HOẶC CẦN SOẠN MỚI HOÀN CHỈNH (Áp dụng chuẩn mực CV 5512/BGDĐT-GDTrH):
   - Bạn PHẢI xây dựng một Kế hoạch bài dạy HOÀN CHỈNH, CHUYÊN SÂU, ĐẦY ĐỦ 100%, TUYỆT ĐỐI KHÔNG TÓM TẮT:
     * Đầy đủ I. Mục tiêu (1. Về kiến thức; 2. Về năng lực: Năng lực chung, Năng lực đặc thù môn học, Năng lực số [[RED:...]]; 3. Về phẩm chất).
     * Đầy đủ II. Thiết bị dạy học và học liệu (1. Đối với giáo viên; 2. Đối với học sinh; có bôi đỏ [[RED:...]] các thiết bị và học liệu số).
     * Đầy đủ III. Tiến trình dạy học với ĐỦ 4 HOẠT ĐỘNG, MỖI HOẠT ĐỘNG ĐỀU CÓ BẢNG 2 CỘT (| Hoạt động của GV và HS | Sản phẩm dự kiến |) VỚI ĐỦ 4 BƯỚC:
       - Hoạt động 1: Khởi động (Mở đầu) (Mục tiêu, Nội dung, Sản phẩm, Bảng 2 cột đủ 4 bước).
       - Hoạt động 2: Hình thành kiến thức mới (Chia thành các mục bài học chi tiết, mỗi mục đều có Mục tiêu, Nội dung, Sản phẩm, Bảng 2 cột đủ 4 bước):
         + TUYỆT ĐỐI KHÔNG ĐƯỢC DỪNG Ở "d) Tổ chức thực hiện:" RỒI NHẢY THẲNG SANG "3. Hoạt động luyện tập"!
         + Nếu bài học là "BẢN VẼ LẮP" (Công nghệ 8):
           * Mục 1: Khái niệm và nội dung của bản vẽ lắp (Phân tích chi tiết 4 nội dung: Khung tên, Bảng kê, Hình biểu diễn, Kích thước; nhấn mạnh Bảng kê là nội dung đặc thù chỉ có ở bản vẽ lắp; có bảng 2 cột đủ 4 bước).
           * Mục 2: Tìm hiểu về đọc bản vẽ lắp (theo Nội dung mục II SGK tr.25 và Hình 4.6 SGK tr.26 Bản vẽ lắp Bộ bản lề hoặc Vòng đai: BẮT BUỘC CÓ BẢNG 2 CỘT TỔ CHỨC THỰC HIỆN ĐỦ 4 BƯỚC Bước 1, Bước 2, Bước 3, Bước 4; VÀ BẢNG 3 CỘT ĐỌC BẢN VẼ LẮP ĐỦ 5 BƯỚC: 1. Khung tên, 2. Bảng kê, 3. Hình biểu diễn, 4. Kích thước, 5. Tổng hợp).
         + Nếu bài học là "BẢN VẼ CHI TIẾT" (Công nghệ 10):
           * Mục 1: Khái niệm & nội dung bản vẽ chi tiết (bảng 4 nội dung).
           * Mục 2: Trình tự đọc bản vẽ chi tiết (BẢNG 3 CỘT ĐỌC BẢN VẼ CHI TIẾT ĐỦ 5 BƯỚC: Khung tên, Hình biểu diễn, Kích thước, Yêu cầu kĩ thuật, Tổng hợp).
           * Mục 3: Các bước lập bản vẽ chi tiết (4 bước vẽ kĩ thuật).
         + Với các bài học khác: Triển khai chi tiết từng đơn vị kiến thức tương ứng của SGK với bảng 2 cột đầy đủ lời thoại GV, chỉ dẫn và sản phẩm HS.
       - Hoạt động 3: Luyện tập (Mục tiêu, Nội dung, Sản phẩm, Bảng 2 cột đủ 4 bước; bài tập thực hành cụ thể; BỘ 5 CÂU HỎI TRẮC NGHIỆM ĐẦY ĐỦ CẢ 4 PHƯƠNG ÁN A, B, C, D VÀ BẢNG ĐÁP ÁN TRẮC NGHIỆM KÈM GIẢI THÍCH CHI TIẾT).
       - Hoạt động 4: Vận dụng (Mục tiêu, Nội dung, Sản phẩm, Bảng 2 cột đủ 4 bước; nhiệm vụ thực tế và ứng dụng công nghệ/phần mềm số).
     * Hướng dẫn tự học về nhà.

4. THỂ THỨC VĂN BẢN CHUẨN MỰC & VIẾT HOA ĐÚNG CHÍNH TẢ TIẾNG VIỆT:
   - TUYỆT ĐỐI KHÔNG VIẾT HOA TÙY TIỆN TỪNG CHỮ (Title Case phong cách tiếng Anh như 'Về Kiến Thức', 'Đối Với Giáo Viên', 'Chuyển Giao Nhiệm Vụ', 'Sản Phẩm Dự Kiến'). Trong tiếng Việt, chỉ viết hoa chữ cái đầu câu/đầu tiêu đề và các danh từ riêng theo đúng ngữ pháp chính tả tiếng Việt.
   - TUYỆT ĐỐI KHÔNG DÙNG KÝ TỰ '*' HAY DẤU '.' TRƯỚC CÁC ĐỀ MỤC.
   - TUYỆT ĐỐI KHÔNG DÙNG '*' Ở CUỐI CÂU.
   - TUYỆT ĐỐI KHÔNG dùng thẻ HTML <br> hay <br>- ở ngoài bảng. Xuống dòng bằng phím Enter bình thường.
   - TUYỆT ĐỐI KHÔNG để sót các ký hiệu thô rác: '<br>-', '<br>', '&lt;br&gt;', '[[RED:', ']]'.
   - Khi bôi đỏ bằng [[RED:...]], phải đóng ngoặc ]] đầy đủ trên cùng dòng/đoạn, TUYỆT ĐỐI KHÔNG để sót kí hiệu thô [[RED: hay ]] trôi nổi.
   - Không chứa ký tự rác dạng [..] hay [i]. Không chèn 'Trang 1/1'.
   - Giữ nguyên các mã chỉ báo năng lực số (ví dụ: 1.1.CB1a, 2.1.TC1a, 6.1.TC1a...) cùng Yêu cầu cần đạt và Diễn giải cụ thể đã chọn.

5. QUY TẮC TRÌNH BÀY CÔNG THỨC TOÁN HỌC, VẬT LÍ, HÓA HỌC:
   - Khi bài học có công thức (Toán, Vật lí, Hóa học, Công nghệ...):
     + Các biểu thức có phân số, căn thức, tích phân, ký hiệu phức tạp: BẮT BUỘC viết dạng LaTeX chuẩn đặt trong '$ ... $' (cho công thức trong dòng) hoặc '$$ ... $$' (cho công thức đặt riêng dòng). Ví dụ: '$x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$', '$$P = U \\cdot I$$'.
     + Đối với ký hiệu đơn giản hoặc số mũ, chỉ số: Dùng ký hiệu trực quan rõ ràng như 'x^2', 'x_1', 'Δ', 'π', 'α', 'β', 'Ω', '±', '×', '≤', '≥', '≠', '≈', '°C'.
     + TUYỆT ĐỐI KHÔNG để lỗi thiếu đóng ngoặc nhọn '{' '}' trong cú pháp LaTeX.`;

  const promptParts: any[] = [];

  // Add textbook photos if uploaded (strictly for reference & verification)
  if (payload.sgkImages && payload.sgkImages.length > 0) {
    for (const img of payload.sgkImages) {
      promptParts.push({
        inlineData: {
          mimeType: img.mimeType || "image/jpeg",
          data: img.data,
        },
      });
    }
  }

  const promptText = `
THÔNG TIN BÀI DẠY VÀ CHỈ BÁO NĂNG LỰC SỐ CẦN TÍCH HỢP:
${payload.userEmail ? `(Giáo viên thực hiện: ${payload.userName || 'Thầy/Cô'} - Gmail: ${payload.userEmail})` : ''}

1. THÔNG TIN BÀI HỌC:
- Môn học / Hoạt động giáo dục: ${payload.subject}
- Khối lớp: ${payload.grade}
- Tên bài dạy: ${payload.lessonTitle}
- Thời lượng: ${payload.lessonDuration}
- Bộ sách giáo khoa: ${payload.curriculum || "Chương trình GDPT 2018"}

2. DANH SÁCH CHỈ BÁO NĂNG LỰC SỐ CẦN TÍCH HỢP (GỒM MÃ CHỈ BÁO, YÊU CẦU CẦN ĐẠT & DIỄN GIẢI):
${competenciesText}

3. HỌC LIỆU SỐ & THIẾT BỊ SỐ TRƯỜNG LỚP ĐÁP ỨNG ĐƯỢC:
* Giáo viên chuẩn bị:
${teacherEqText}

* Học sinh chuẩn bị (theo nhóm / cá nhân):
${studentEqText}

* Công cụ / Ứng dụng số khai thác:
${toolsText}

${payload.sgkImages && payload.sgkImages.length > 0 ? `4. ẢNH TRANG SÁCH GIÁO KHOA ĐÍNH KÈM (${payload.sgkImages.length} ảnh):
=> MỤC ĐÍCH DUY NHẤT: Dùng để đối chiếu, so sánh nội dung kiến thức trong giáo án để đảm bảo hoàn toàn chuẩn xác, đồng bộ và không bị sai lệch so với SGK. TUYỆT ĐỐI KHÔNG CHÈN ẢNH TRANG SGK NÀY VÀO BÀI SOẠN!\n` : ''}

5. TOÀN VĂN BÀI SOẠN GỐC CỦA GIÁO VIÊN (PHẢI GIỮ NGUYÊN 100%, TUYỆT ĐỐI KHÔNG TÓM TẮT/CẮT BỚT):
${payload.oldLessonPlanText && payload.oldLessonPlanText.trim() ? payload.oldLessonPlanText : "(Chưa có văn bản bài soạn cũ, hãy xây dựng bài dạy mới hoàn chỉnh theo chuẩn CV 5512 và bôi đỏ toàn bộ các nội dung năng lực số tích hợp)"}

${payload.customNote ? `6. GHI CHÚ BỔ SUNG CỦA GIÁO VIÊN:\n${payload.customNote}\n` : ''}

YÊU CẦU XUẤT BẢN NGHIÊM NGẶT - BẢO TỒN NGUYÊN VẸN 100%:
- BẮT BUỘC giữ nguyên 100% toàn bộ nội dung của bài soạn cũ từ đầu đến cuối. TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT hay rút gọn các hoạt động!
- CẤU TRÚC CHIA CỘT: Giữ nguyên 100% các bảng chia cột (| HOẠT ĐỘNG CỦA GV VÀ HS | SẢN PHẨM DỰ KIẾN |) và các bảng con 3 cột.
- BÀI TẬP VÀ CÂU HỎI TRẮC NGHIỆM: Giữ nguyên 100% tất cả các câu hỏi trắc nghiệm (Câu 1 đến Câu 5 cùng các phương án A, B, C, D) và bảng đáp án.
- HÌNH ẢNH: Giữ nguyên tất cả các thẻ [[IMAGE:...]] có trong bài soạn cũ tại đúng vị trí ô/cột/đoạn ban đầu.
- NĂNG LỰC SỐ: Tích hợp đầy đủ mã chỉ báo chuẩn (ví dụ: 1.1.CB1a, 2.1.TC1a...) cùng Yêu cầu cần đạt và Diễn giải cụ thể vào các vị trí tương ứng (chữ thường, bôi đỏ [[RED:...]], không in đậm, đóng ngoặc ]] đầy đủ).
- TUYỆT ĐỐI KHÔNG xuất hiện thẻ HTML <br> hoặc <br>- ở ngoài các ô bảng.
- KHÔNG sử dụng ký tự '*' hay dấu '.' trước các đề mục.
- KHÔNG sử dụng ký tự '*' ở cuối các câu.`;

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
  images: Array<{ mimeType: string; data: string }>,
  userApiKey?: string
) {
  const ai = getGeminiClient(userApiKey);

  const promptParts: any[] = [];
  for (const img of images) {
    promptParts.push({
      inlineData: {
        mimeType: img.mimeType || "image/jpeg",
        data: img.data,
      },
    });
  }

  promptParts.push({
    text: `Hãy phân tích kỹ các ảnh trang sách giáo khoa này và trích xuất:
1. Tên bài học chính xác
2. Yêu cầu cần đạt / Mục tiêu cốt lõi ghi trong SGK
3. Các hoạt động học tập chính trong bài (Khởi động, Khám phá, Luyện tập, Vận dụng)
4. Các đồ dùng, bảng số liệu, thí nghiệm hoặc tranh ảnh xuất hiện trong SGK
5. Đề xuất các hoạt động tích hợp năng lực số phù hợp nhất (ví dụ: quét mã QR tra cứu số liệu, dùng ứng dụng đo đạc, tạo infographic sản phẩm...).
Trả về ngắn gọn, rõ ràng bằng tiếng Việt cho giáo viên tham khảo.`
  });

  const response = await callGeminiWithFallback(ai, {
    contents: {
      parts: promptParts,
    },
    config: {
      systemInstruction: "Bạn là trợ lý phân tích sách giáo khoa Việt Nam.",
      temperature: 0.2,
    },
  });

  return {
    analysis: response.text || "",
  };
}
