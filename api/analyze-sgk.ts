import { handleAnalyzeSgk } from '../src/server/geminiHandler.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { images, userApiKey: bodyKey } = req.body;
    const userApiKey = req.headers['x-user-gemini-key'] || bodyKey;
    const result = await handleAnalyzeSgk(images, userApiKey);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error analyzing SGK:', err);
    res.status(500).json({ error: err.message || 'Lỗi phân tích sách giáo khoa' });
  }
}
