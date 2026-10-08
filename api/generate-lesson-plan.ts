export const maxDuration = 60;
import { handleGenerateLessonPlan } from '../src/server/geminiHandler';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const payload = req.body;
    const userApiKey = req.headers['x-user-gemini-key'] || payload.userApiKey;
    const userEmail = req.headers['x-user-email'] || payload.userEmail;
    const result = await handleGenerateLessonPlan({
      ...payload,
      userApiKey,
      userEmail,
    });
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error generating lesson plan:', err);
    res.status(500).json({ error: err.message || 'L?i x? lý k? ho?ch bài d?y' });
  }
}

