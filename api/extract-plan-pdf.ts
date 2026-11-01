export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { handleExtractPlanPdf } = await import('./_lib/geminiHandler.js');
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    const { pdfBase64, userApiKey: bodyKey } = body || {};
    const userApiKey = req.headers?.['x-user-gemini-key'] || bodyKey;
    const result = await handleExtractPlanPdf(pdfBase64, userApiKey);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error extracting PDF:', err);
    return res.status(500).json({ error: err?.message || 'Lỗi trích xuất tệp PDF giáo án' });
  }
}