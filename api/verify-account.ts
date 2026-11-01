export const maxDuration = 60;
import { handleVerifyAccount } from './_lib/geminiHandler';

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
        error: 'Vui lòng dán khóa Gemini API được tạo từ tài khoản Gmail của Thầy/Cô (bắt đầu bằng AIzaSy...).',
      });
    }

    const result = await handleVerifyAccount(apiKey);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Verify account error:', err);
    return res.status(400).json({
      error: err?.message || 'Lỗi hệ thống khi xác thực. Vui lòng thử lại sau.',
    });
  }
}