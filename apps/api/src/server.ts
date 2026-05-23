import { buildApp } from './app.js';
import { config } from './config.js';

/**
 * Bootstrap：實際綁 port 啟動服務。
 *
 * 把 listen 從 app.ts 分出來，是為了：
 * - 測試時 buildApp() + .inject() 不需要真的開 port
 * - 對應 12-Factor Factor 7 (P.33): port binding 由外部 (env) 決定
 * - 對應 12-Factor Factor 9 (P.35): disposability —— 處理 SIGTERM graceful shutdown
 */
const app = await buildApp();

const port = config.PORT;
const host = config.HOST;

// Graceful shutdown handler
// 對應 12-Factor Factor 9 (P.35): "Graceful shutdown on SIGTERM"
// K8s 在 pod terminate 時會先送 SIGTERM、給你 30s 結束在途請求，再 SIGKILL
const closeOnSignal = async (signal: string): Promise<void> => {
  app.log.info(`Received ${signal}, closing server...`);
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => void closeOnSignal('SIGTERM'));
process.on('SIGINT', () => void closeOnSignal('SIGINT'));

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error({ err }, 'Failed to start server');
  process.exit(1);
}
