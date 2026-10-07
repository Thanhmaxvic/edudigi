import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleGenerateLessonPlan, handleAnalyzeSgk, handleVerifyAccount, handleExtractPlanPdf } from './src/server/geminiHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.post('/api/verify-account', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const result = await handleVerifyAccount(apiKey);
    res.json(result);
  } catch (err: any) {
    console.error('Error verifying account:', err);
    res.status(400).json({ error: err.message || 'Không thể xác thực tài khoản' });
  }
});

app.post('/api/generate-lesson-plan', async (req, res) => {
  try {
    const userApiKey = (req.headers['x-user-gemini-key'] as string) || req.body.userApiKey;
    const userEmail = (req.headers['x-user-email'] as string) || req.body.userEmail;
    const payload = {
      ...req.body,
      userApiKey,
      userEmail,
    };
    const result = await handleGenerateLessonPlan(payload);
    res.json(result);
  } catch (err: any) {
    console.error('Error generating lesson plan:', err);
    res.status(500).json({ error: err.message || 'Lỗi xử lý kế hoạch bài dạy' });
  }
});

app.post('/api/analyze-sgk', async (req, res) => {
  try {
    const userApiKey = (req.headers['x-user-gemini-key'] as string) || req.body.userApiKey;
    const { images } = req.body;
    const result = await handleAnalyzeSgk(images, userApiKey);
    res.json(result);
  } catch (err: any) {
    console.error('Error analyzing SGK:', err);
    res.status(500).json({ error: err.message || 'Lỗi phân tích SGK' });
  }
});

app.post('/api/extract-plan-pdf', async (req, res) => {
  try {
    const userApiKey = (req.headers['x-user-gemini-key'] as string) || req.body.userApiKey;
    const { pdfBase64 } = req.body;
    const result = await handleExtractPlanPdf(pdfBase64, userApiKey);
    res.json(result);
  } catch (err: any) {
    console.error('Error extracting PDF lesson plan:', err);
    res.status(500).json({ error: err.message || 'Lỗi trích xuất giáo án PDF' });
  }
});

// Serve static assets from dist
app.use(express.static(path.resolve(process.cwd(), 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
