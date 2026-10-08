import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import {
  handleGenerateLessonPlan,
  handleAnalyzeSgk,
  handleVerifyAccount,
} from './src/server/geminiHandler';

dotenv.config();

function serverApiPlugin(): Plugin {
  return {
    name: 'server-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method === 'POST' && req.url === '/api/verify-account') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { apiKey } = JSON.parse(body);
              const result = await handleVerifyAccount(apiKey);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Error verifying account:', err);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Không thể xác thực tài khoản' }));
            }
          });
          return;
        }

        if (req.method === 'POST' && req.url === '/api/generate-lesson-plan') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body);
              const userApiKey = (req.headers['x-user-gemini-key'] as string) || payload.userApiKey;
              const userEmail = (req.headers['x-user-email'] as string) || payload.userEmail;
              const result = await handleGenerateLessonPlan({
                ...payload,
                userApiKey,
                userEmail,
              });
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Error generating lesson plan:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Lỗi xử lý kế hoạch bài dạy' }));
            }
          });
          return;
        }

        if (req.method === 'POST' && req.url === '/api/analyze-sgk') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { images, userApiKey: bodyKey } = JSON.parse(body);
              const userApiKey = (req.headers['x-user-gemini-key'] as string) || bodyKey;
              const result = await handleAnalyzeSgk(images, userApiKey);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              console.error('Error analyzing SGK:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Lỗi phân tích sách giáo khoa' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), serverApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
