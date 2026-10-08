export const maxDuration = 60;
import { handleVerifyAccount } from '../src/server/geminiHandler';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { apiKey } = req.body;
    const result = await handleVerifyAccount(apiKey);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error verifying account:', err);
    res.status(400).json({ error: err.message || 'Không th? xác th?c tài kho?n' });
  }
}

