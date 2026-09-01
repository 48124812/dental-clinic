import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // transpilePackages: 告訴 Next.js 把這些 workspace package 視為「自家 source」
  // 一起跑 Babel / SWC 編譯。沒這設定，從 node_modules 載入 .ts 會炸。
  // 對應 12-Factor Factor 2: explicit dependencies.
  transpilePackages: ["@dental-clinic/shared"],
  // Produce the minimal Node.js server consumed by apps/web/Dockerfile.
  // The tracing root must be the monorepo root so workspace dependencies are
  // included in the standalone image.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
