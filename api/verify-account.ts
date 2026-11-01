export const maxDuration = 60;

function cleanApiKey(rawKey?: unknown): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return rawKey
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s+/g, '');
}

function mapGoogleAuthError(rawText: string): string | null {
  if (rawText.includes('API_KEY_INVALID') || rawText.includes('API key not valid')) {
    return 'Khóa API không hợp lệ. Vui lòng kiểm tra lại mã khóa (bắt đầu bằng AIzaSy...) được tạo từ Google AI Studio (aistudio.google.com/apikey) bằng tài khoản Gmail của Thầy/Cô.';
  }
  if (rawText.includes('API_KEY_EXPIRED') || rawText.includes('API key expired')) {
    return 'Khóa Gemini API này đã hết hạn. Vui lòng tạo khóa mới miễn phí tại aistudio.google.com/apikey.';
  }
  if (
    rawText.includes('API_KEY_SERVICE_BLOCKED') ||
    rawText.includes('CONSUMER_SUSPENDED') ||
    rawText.includes('Generative Language API has not been used')
  ) {
    return 'Khóa API bị chặn quyền truy cập Generative Language API (403). Vui lòng tạo khóa mới trong dự án mặc định trên aistudio.google.com/apikey.';
  }
  return null;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
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

    const cleanKey = cleanApiKey(body?.apiKey || req.headers?.['x-user-gemini-key']);
    if (!cleanKey) {
      return res.status(400).json({
        error: 'Vui lòng dán khóa Gemini API được tạo từ tài khoản Gmail của Thầy/Cô (bắt đầu bằng AIzaSy...).',
      });
    }

    if (!/^[A-Za-z0-9_-]{20,}$/.test(cleanKey)) {
      return res.status(400).json({
        error: 'Định dạng khóa API không hợp lệ. Khóa chuẩn bắt đầu bằng AIzaSy... và không chứa khoảng trắng hay dấu tiếng Việt.',
      });
    }

    // 1. Zero-dependency, zero-quota verification via Google Gemini REST models endpoint
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=20&key=${encodeURIComponent(
      cleanKey
    )}`;
    const modelsRes = await fetch(modelsUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'aistudio-build' },
    });
    const modelsText = await modelsRes.text();
    let modelsData: any = null;
    try {
      modelsData = JSON.parse(modelsText);
    } catch (_) {}

    if (modelsRes.ok && modelsData && Array.isArray(modelsData.models)) {
      return res.status(200).json({
        valid: true,
        message:
          'Xác thực tài khoản Gmail và khóa Gemini API cá nhân thành công! Hạn ngạch miễn phí đã sẵn sàng.',
      });
    }

    const authErr = mapGoogleAuthError(modelsText);
    if (authErr) {
      return res.status(400).json({ error: authErr });
    }

    // 2. Fallback check via lightweight generateContent in case models.list is scoped/restricted
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
    for (const model of candidateModels) {
      const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`;
      const genRes = await fetch(genUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'aistudio-build',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'OK' }] }],
          generationConfig: { maxOutputTokens: 3 },
        }),
      });
      const genText = await genRes.text();
      if (genRes.ok) {
        return res.status(200).json({
          valid: true,
          message:
            'Xác thực tài khoản Gmail và khóa Gemini API cá nhân thành công! Hạn ngạch miễn phí đã sẵn sàng.',
        });
      }
      const genAuthErr = mapGoogleAuthError(genText);
      if (genAuthErr) {
        return res.status(400).json({ error: genAuthErr });
      }
    }

    return res.status(400).json({
      error:
        modelsData?.error?.message ||
        'Không thể kết nối xác thực với Google Gemini. Vui lòng kiểm tra lại khóa API của Thầy/Cô.',
    });
  } catch (err: any) {
    console.error('Verify account error:', err);
    return res.status(400).json({
      error: err?.message || 'Lỗi hệ thống khi xác thực khóa API. Vui lòng thử lại sau.',
    });
  }
}