import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output：Next.js 自動分析 runtime 需要的最小 module 集，
  // 產生 .next/standalone/ 目錄含一個 server.js 與只必要的 node_modules。
  // 配 Docker 用幾乎是必設。
  output: "standalone",

  // outputFileTracingRoot：告訴 Next.js 從哪一層追蹤 file dependencies。
  // Monorepo 必設（預設只追到 package 根，會漏掉 workspace 內的共用 package）。
  //
  // 用 process.cwd() 而非 import.meta.url 因為 next.config.ts 會被
  // compile 成 CJS（apps/web 沒設 "type": "module"），ESM-only API 會炸。
  // next build 跑時 cwd = apps/web → ../.. = monorepo 根。
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),

  // transpilePackages: 告訴 Next.js 把這些 workspace package 視為「自家 source」
  // 一起跑 Babel / SWC 編譯。沒這設定，從 node_modules 載入 .ts 會炸。
  // 對應 12-Factor Factor 2: explicit dependencies.
  transpilePackages: ["@dental-clinic/shared"],
};

export default nextConfig;
