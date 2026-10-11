export const maxDuration = 60;
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }

    const apiKey = body?.apiKey;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({
        error: 'Vui lòng dán khóa Gemini API được tạo từ tài khoản Gmail của Thầy/Cô (bắt đầu bằng AIzaSy...).'
      });
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

    const testModels = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let verified = false;
    let lastError: any = null;

    for (const model of testModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: "Xin chào",
          config: {
            maxOutputTokens: 5,
          },
        });
        if (response) {
          verified = true;
          break;
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        if (msg.includes("API key not valid") || msg.includes("INVALID_ARGUMENT") || msg.includes("API_KEY_INVALID") || msg.includes("403")) {
          break;
        }
      }
    }

    if (!verified) {
      const errorMsg = lastError?.message || String(lastError);
      if (errorMsg.includes("API key not valid") || errorMsg.includes("INVALID_ARGUMENT") || errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("403")) {
        return res.status(400).json({
          error: 'Khóa API không hợp lệ. Vui lòng kiểm tra lại mã khóa tạo từ Google AI Studio (aistudio.google.com/apikey) bằng tài khoản Gmail của Thầy/Cô.'
        });
      }
      return res.status(400).json({
        error: `Không thể kết nối đến Google Gemini: ${errorMsg}`
      });
    }

    return res.status(200).json({
      valid: true,
      message: 'Xác thực tài khoản Gmail và khóa Gemini API cá nhân thành công! Hạn ngạch miễn phí đã sẵn sàng.'
    });
  } catch (err: any) {
    console.error('Verify account error:', err);
    return res.status(500).json({
      error: `Lỗi hệ thống khi xác thực: ${err?.message || 'Vui lòng thử lại sau.'}`
    });
  }
}