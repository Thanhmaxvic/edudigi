export const maxDuration = 60;
import { handleAnalyzeSgk } from './_lib/geminiHandler';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    const { images, userApiKey: bodyKey } = body || {};
    const userApiKey = req.headers['x-user-gemini-key'] || bodyKey;
    const result = await handleAnalyzeSgk(images, userApiKey);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error analyzing SGK:', err);
    res.status(500).json({ error: err.message || 'Lá»—i phÃ¢n tÃ­ch sÃ¡ch giÃ¡o khoa' });
  }
}