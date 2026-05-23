import { z } from 'zod';

/**
 * Typed application config.
 *
 * 對應講義：
 * - 12-Factor Factor 3 (P.25-27): Config strictly separate from code
 * - 12-Factor SDLC P.74: Config/secrets externalized
 *
 * 策略：
 *   1. 啟動時 parse 一次 process.env
 *   2. 任何欄位不對 → 立刻 process.exit(1) + 印清楚錯誤
 *   3. 其他 code 一律 import 這個 `config`，不再讀 process.env
 *
 * 為什麼 fail-fast？
 *   - 「跑起來才 crash」比「啟動就 crash」難 debug N 倍
 *   - K8s 看到 process.exit(1) 會自動重啟 + 在 dashboard 紅燈
 *   - prod 不會出現「忘記設 DATABASE_URL 但服務還在收 request」這種詭異狀態
 */

const ConfigSchema = z.object({
  // ----- Server -----
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),

  // ----- Logging -----
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // ----- Database -----
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // ----- CORS -----
  // "url1,url2,url3" → ["url1", "url2", "url3"]
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),

  // ----- App metadata -----
  // 之後 Phase 6 CI 會把 git SHA 注進來 → /health 能告訴你跑的是哪版
  APP_VERSION: z.string().default('dev'),

  // ----- Node env -----
  // production: prod 行為（壓縮 log、嚴格 mode）
  // development / test: dev/test 行為
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type Config = z.infer<typeof ConfigSchema>;

function parseConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    /* eslint-disable no-console */
    console.error('❌ Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nCheck your .env file or env vars and try again.');
    /* eslint-enable no-console */
    process.exit(1);
  }

  return result.data;
}

export const config: Config = parseConfig();
