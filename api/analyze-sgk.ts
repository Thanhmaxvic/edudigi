export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { handleAnalyzeSgk } = await import('./_lib/geminiHandler.js');
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    const { images, userApiKey: bodyKey } = body || {};
    const userApiKey = req.headers?.['x-user-gemini-key'] || bodyKey;
    const result = await handleAnalyzeSgk(images, userApiKey);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error analyzing SGK:', err);
    return res.status(500).json({ error: err?.message || 'Lỗi phân tích sách giáo khoa' });
  }
}