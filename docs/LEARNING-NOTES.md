# 學習筆記 — Cloud Native 牙醫診所專案

> **這是會持續長大的筆記**。每次 Phase 教新東西時都會回來補上。
>
> **使用方式**：Ctrl+F 搜「我想做什麼」（例如「開 PR」「跑 dev server」「Postgres」），找到對應段落看 what / why / 踩雷。

---

## 📑 目錄

- [Quick Reference 速查表](#quick-reference-速查表)
- [Phase 1 — Design Thinking](#phase-1--design-thinking)
- [Phase 2 — 專案啟動](#phase-2--專案啟動)
- [Phase 3 — MVP 開發](#phase-3--mvp-開發)
- [常見踩雷集](#常見踩雷集)
- [12-Factor 對應地圖](#12-factor-對應地圖)
- [Git 完整指令清單](#git-完整指令清單)

---

## Quick Reference 速查表

### 🌳 Git 日常 PR 流程

```powershell
# 1. 從 main 開 feature branch
git switch -c feat/short-description

# 2. 改完 code 後
git add .
git status                              # 確認 staged 內容
git commit -m "type(scope): summary

Body explaining what / why / how.

Closes #N"                              # 自動 close 對應 issue

# 3. 推到雲端 + 開 PR
git push -u origin feat/short-description
gh pr create --fill --base main

# 4. 網頁 merge + 點 Delete branch

# 5. 同步本地
git switch main
git pull
git fetch --prune                       # 清掉遠端已刪的 branch ref
git branch -d feat/short-description    # 刪本地 branch
```

### 🐳 Docker Compose 速查

```powershell
docker compose up -d           # 背景啟動所有 services
docker compose ps              # 看 services 狀態（含 healthy）
docker compose logs -f postgres # 看某 service 即時 log
docker compose down            # 停止並移除 container
docker compose down -v         # 同上 + 刪 volume（資料全沒）
```

### 🗄️ Prisma 速查

```powershell
pnpm --filter @dental-clinic/api db:generate     # 重生 Client（改 schema 後）
pnpm --filter @dental-clinic/api db:migrate      # 新 migration + 套用 + 重生 Client
pnpm --filter @dental-clinic/api db:seed         # 跑樣本資料
pnpm --filter @dental-clinic/api db:studio       # Prisma Studio (網頁 DB GUI)
pnpm --filter @dental-clinic/api db:reset        # 砍 DB 重來
```

### 🟢 Node / pnpm 速查

```powershell
pnpm install                                    # root 跑，會裝所有 workspace 的 deps
pnpm --filter @dental-clinic/web dev            # 跑前端 dev server
pnpm --filter @dental-clinic/api dev            # 跑後端 dev server
pnpm -r --parallel run dev                      # 全部 workspace 並行跑 dev
pnpm --filter @dental-clinic/api typecheck      # 跑型別檢查
```

### 🔌 HTTP / API 測試（PowerShell）

```powershell
# JSON 回應一律用 irm（會自動解 JSON + UTF-8）
irm http://localhost:3001/api/doctors

# 看詳細的物件結構
irm http://localhost:3001/api/doctors | Format-List | Select-Object -First 30

# 看 HTTP status code
curl.exe -s -o $null -w "%{http_code}`n" http://localhost:3001/api/doctors/notexist
```

### 🐘 Postgres / psql 速查

```powershell
# 進 container 內的 psql
docker exec -it dental-clinic-db psql -U dental -d dental

# 進去後常用 backslash 指令
\l         -- list databases
\dt        -- list tables in current schema
\d "Doctor"  -- describe Doctor table
\q         -- quit
```

---

## Phase 1 — Design Thinking

> 對應講義：Design Thinking & UX 2026 P.11–37

### 🎯 核心心法

**Requirement-first vs Solution-first**：
- ❌ 拿到需求就開始想框架 / API
- ✅ 先問「真正的問題是什麼、為誰解、解了什麼價值」
- 「新創失敗主因 = 打造出沒人要的東西」（講義 P.3）

### 工具 1：Empathy Map（同理用戶）

4 個象限（NN/g 標準）：

| 象限 | 內容 |
|------|------|
| **Says** | 使用者會說的話（外顯） |
| **Thinks** | 使用者心裡想的（內隱） |
| **Does** | 使用者實際做的行為 |
| **Feels** | 使用者的情緒 |

加上：
- **表面需求** — 使用者直接說出的
- **深層恐懼** — 使用者沒講但會影響決策的

### 工具 2：User Story 三段式

```
身為 [具體角色]，
我想要 [可觀察的需求]，
這樣才能 [使用者價值]。
```

**錯誤示範**：
- ❌「身為使用者」（不具體）
- ❌「想要更好的體驗」（不可觀察）
- ❌「這樣才能提升回訪率」（是商業 KPI 不是使用者價值）

**正確示範**：
- ✅「身為**牙痛急著找牙醫的病患**，我想要**在首頁就看到今天能不能看、電話、地址**，這樣才能**立刻決定是否前往**」

### 工具 3：Acceptance Criteria (AC)

三段式：

| 前置情境 | 觸發條件 | 期望結果 |
|---------|---------|---------|
| 使用者已選醫師與時段 | 點「確認預約」並填完資料 | 系統儲存預約並回傳預約編號 |

**重點**：
- AC ≠ 實作方式（不要寫「用 Firebase 發推播」，要寫「系統發送通知」）
- AC 必須**可驗證**（不是「美觀直覺」這種廢話）

### 工具 4：MVP 範圍

對應講義 P.49–50「能滑的滑板」：
- ❌ 半成品的車（沒輪子的車是垃圾）
- ✅ 滑板（小但完整、能驗證核心價值）

MVP 必做：能跑通「核心使用流程」的最小路徑。

### 工具 5：Definition of Done (DoD)

每條 Story close 前都要過：
- 程式碼通過 lint + type check
- 有對應的測試
- AC 所有情境都驗過
- 沒有 secret 寫死
- Log 用 stdout
- PR 描述完整、CI 全綠

---

## Phase 2 — 專案啟動

### 安裝開發工具（winget）

```powershell
# 為什麼用 winget：可重複、可升級（vs 手動下載 .msi）
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
winget install -e --id GitHub.cli       --accept-package-agreements --accept-source-agreements
winget install -e --id pnpm.pnpm        --accept-package-agreements --accept-source-agreements
```

- `-e` = exact match（避免裝到名稱相似的錯誤套件）
- 裝完**重啟 terminal 或 VS Code** 才會抓到新 PATH

### Windows 強制 PowerShell 跑 .ps1（一次性）

**問題**：Windows 預設 ExecutionPolicy 是 Restricted，不能跑 .ps1。

**修法**（以系統管理員開 PowerShell）：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

- `RemoteSigned` = 本機腳本可跑、網路下載的需簽章
- `-Scope CurrentUser` = 只影響你的帳號

### Git 全域設定

```powershell
git config --global user.name "<github-username>"
git config --global user.email "<id>+<username>@users.noreply.github.com"
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.autocrlf input
git config --global core.editor "code --wait"
```

**Email 用 GitHub noreply** = 隱私保護，真實信箱不會寫進 Git 歷史。
- 取得 noreply 格式：`<id>+<login>@users.noreply.github.com`，id 從 `gh api user` 取得

`core.autocrlf=input` = Windows commit 時自動轉成 LF（避免跨平台「整檔 diff」災難）。

### GitHub 登入

```powershell
gh auth login --hostname github.com --git-protocol https --web
```

OAuth Device Flow：跳一組 8 位數字 → 瀏覽器貼進 `https://github.com/login/device` → Authorize。

### 開 GitHub Repo

```powershell
# 在 local repo 內跑
gh repo create dental-clinic --public --source=. --description "..." --remote=origin
git push -u origin main
```

- `--source=.` = 用當前資料夾
- `--remote=origin` = 把 GitHub repo 設成 remote `origin`
- `-u` = 設 upstream，之後 `git push` 不用打全名

### 初始化 Git Repo

```powershell
git init
git add .
git commit -m "chore: initial commit"
git status                # 確認狀態
git log --oneline -3      # 看歷史
```

**`.gitignore` 必備項**：node_modules、dist、.env*、.next、.cache、IDE 設定、log 檔。
**`.gitattributes` 必備**：`* text=auto eol=lf` 統一換行符。

### Branch Protection（GitHub 網頁設定）

路徑：Repo → Settings → Branches → Add ruleset

對 `main` 啟用：
- Restrict deletions（禁刪）
- Block force pushes（禁 force push）
- Require a pull request before merging（必走 PR）— 一人專案先**不要**勾「Require approvals」

### Conventional Commits 格式

```
<type>(<scope>): <summary>

<body — what / why / how>

Closes #<issue-number>
```

- `type`: `feat | fix | docs | chore | refactor | test | ci | perf`
- **`Closes #N` 在 commit 或 PR body 出現** → merge 後自動關 issue（GitHub 魔法）

### GitHub CLI Issue / Label 速查

```powershell
gh issue list --label sprint:1 --state open
gh issue edit <N> --add-label sprint:1
gh issue edit <N> --remove-label sprint:1
gh label create <name> --color <hex> --description "..." --force
gh issue create --title "..." --body "..." --label "P0,story"
```

### Sprint Planning（Agile）

對應講義 P.50–56：
- **Sprint Goal** — 一句話的目標
- **Sprint Backlog** — 從 Product Backlog 撈 N 條 Story
- **Story Points** — 相對複雜度（費氏數列 1-2-3-5-8）；不是工時
- **Definition of Done** — 每條都要符合才能 close

---

## Phase 3 — MVP 開發

### 3.1 Monorepo 結構

**為什麼用 pnpm workspaces**：
- 同 package 全機共享一份（symlink），比 npm/yarn 省 70% 空間
- 一個 commit 涵蓋 FE + BE 變更，PR 看 diff 一次到位

**根目錄關鍵檔**：
| 檔案 | 角色 |
|------|------|
| `package.json` | root metadata + 共用 scripts |
| `pnpm-workspace.yaml` | 宣告哪些資料夾是 workspace 成員 |
| `tsconfig.base.json` | 共用 TS strict 設定（子 package extends） |
| `.nvmrc` | 指定 Node 版本（給 nvm 用） |

**根 `package.json` 重點**：
```json
{
  "engines": { "node": ">=22.0.0", "pnpm": ">=10.0.0" },
  "packageManager": "pnpm@10.0.0"
}
```
- `engines` = 防止用錯版本
- `packageManager` = corepack 會強制使用這版 pnpm

### 3.2 Next.js 前端

**Bootstrap 指令**：
```powershell
cd apps
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --skip-install --no-git
```

**旗標說明**：
| 旗標 | 為什麼 |
|------|--------|
| `--app` | 用 App Router（Pages Router 已 legacy） |
| `--src-dir` | code 放 `src/`，配置與 code 分離 |
| `--import-alias "@/*"` | `@/components/...` 取代 `../../../` |
| `--turbopack` | Next 15+ 推薦的快編譯器 |
| `--skip-install` | monorepo 在 root 統一裝 |
| `--no-git` | 避免 nested .git |

**Monorepo 命名慣例**：把 `name` 改成 scoped：`@dental-clinic/web`

**子 tsconfig 必設**：`"extends": "../../tsconfig.base.json"` 繼承共用 strict 選項

### 3.3 Fastify 後端

**分離 app.ts vs server.ts**：
- `app.ts` = factory，可被 `.inject()` 測試（不開 port）
- `server.ts` = 綁 port、處理 SIGTERM graceful shutdown
- 對應 12-Factor Factor 9 disposability

**ESM imports — 用 `.js` 不是 `.ts`**：
```ts
import { buildApp } from './app.js';   // ✅ 不是 './app.ts'
```
原因：Node ESM 規範要求副檔名是「最終產出」的；source 是 .ts 但 build 出 .js。tsx 會幫忙處理 dev。

**pino logger（Fastify 預設）**：
- 每行是 JSON、寫到 stdout、附 reqId
- 對應 12-Factor Factor 11 logs as event streams

**Graceful SIGTERM**：
```ts
process.on('SIGTERM', () => void closeOnSignal('SIGTERM'));
```
K8s 終止 pod 流程：SIGTERM → 30 秒 grace period → SIGKILL。沒寫這段在 K8s 上會丟資料。

**Dev / Build / Start scripts**：
```json
{
  "dev": "tsx watch --env-file=.env src/server.ts",
  "build": "tsc",
  "start": "node --env-file=.env dist/server.js"
}
```
- `tsx watch` = TS 直接跑 + 監聽改檔自動重啟
- `--env-file` = Node 20.6+ / tsx 4+ 內建讀 .env

### 3.4 Docker Compose + Postgres

**為什麼用 Docker 跑 DB 而不直接裝**：
- 多版本共存（學習用 16，明天試 17 不影響）
- `docker compose down -v` 一鍵清乾淨
- 跨 OS 一致

**docker-compose.yml 關鍵欄位**：
| 欄位 | 做什麼 |
|------|--------|
| `image: postgres:16-alpine` | Alpine 版小（~80MB vs 400MB） |
| `environment.POSTGRES_*` | 從 root `.env` 讀（變數插值） |
| `ports: "5432:5432"` | container 內 port 對應到本機 |
| `volumes: postgres-data:/var/lib/postgresql/data` | 資料持久化 |
| `healthcheck` | 用 `pg_isready` 判斷 service 真的能接連線 |

**`.env` 策略**：
- 根目錄 `.env`（gitignored）→ Docker Compose 讀
- 各 app 自己的 `.env`（gitignored）→ app 與 Prisma 讀
- `.env.example` 進 Git，只放 placeholder

### 3.5 Prisma — DB 的 TypeScript 翻譯員

**3 個核心概念**：
| 概念 | 是什麼 |
|------|------|
| `schema.prisma` | DB 結構聲明檔 + 連線設定 |
| Migration | Prisma 自動產生的 SQL `ALTER TABLE ...`，**必須 commit** |
| Prisma Client | 從 schema 產生的 TypeScript SDK |

**ID 策略**：`@default(cuid())`
- URL safe、單調遞增、不洩漏「我們有 N 筆」
- 比 UUID v4 短、比 auto-increment int 安全

**Postgres 原生 array**：Prisma schema 寫 `String[]` → Postgres `text[]`，比 join table 簡單。

**Singleton PrismaClient**：
```ts
export const prisma = new PrismaClient({ ... });
```
不能每個 request `new` 一個，會把連線池打爆。

**Seed 用 upsert（idempotent）**：
```ts
await prisma.doctor.upsert({ where: { id }, update: data, create: data });
```
重複跑不會炸，dev 友善。

### 3.6 分層架構

**3 層 + 依賴方向**：
```
Route (controller)    HTTP I/O，解 query/body，組 response
   ↓
Service (domain)      業務邏輯，pure 越多越好，不知道 HTTP
   ↓
Repository (DAO)      唯一直接 import prisma 的層
```

**規則**：
- ❌ Route 直接 import prisma
- ❌ Service 知道 HTTP
- ❌ Repository 寫業務規則
- ✅ Service 回 `null` → Route 自己決定 map 成 404 還是其他

**Service 「pure function」設計**（為了測試）：
```ts
// 注入 now 而不是內部呼叫 new Date()
export function computeTodayStatus(weekly: BusinessHours[], now: Date) {...}
```
測試時可以餵任意時間進去。

**CORS**：
```ts
await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
});
```
前端在 3000、後端在 3001 → 跨來源 → 後端必須允許前端 origin。

### 3.7 Next.js Server Components + SSR

**React Server Component (RSC)**：
```tsx
export default async function HomePage() {
  const data = await getBusinessHoursSummary();  // ← server 端跑、HTML 帶資料送瀏覽器
  return <main>...</main>;
}
```
- 可以 `async`、可以 `await fetch`/`await db`
- 不能用 `useState` / `useEffect` / event handler（那是 client component）
- SEO 友善（爬蟲拿到完整 HTML）

**fetch 與 cache**：
```ts
fetch(url, { cache: 'no-store' })       // dev 永遠打 API
fetch(url, { next: { revalidate: 60 } }) // ISR：60 秒重新抓
```

**SEO Metadata API**：
```tsx
export const metadata: Metadata = {
  title: { default: '...', template: '%s | 光明牙醫診所' },
  description: '...',
  openGraph: { locale: 'zh_TW', type: 'website' },
};
```

## Phase 4 — 12-Factor 強化

### 4.1 Typed Config with Zod (fail-fast on bad env)

**問題**：`process.env.X` 永遠是 `string | undefined`，散落 5–10 個檔案、沒驗證、忘記設 prod 才發現。

**解法**：用 Zod schema 在 app 啟動時 parse 一次 process.env，產出 typed `config` 物件。錯就直接 `process.exit(1)`。

**模式**：
```ts
const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),                   // 必填、要是 URL
  LOG_LEVEL: z.enum(['debug', 'info', ...]).default('info'),
  CORS_ORIGIN: z.string().default('http://...').transform(s => s.split(',')),
});

export const config = ConfigSchema.parse(process.env);  // 啟動就驗
```

**用法**：之後所有檔案都 `import { config } from './config.js'`，**不再讀 `process.env`**。

**好處**：
- TypeScript 知道型別（`config.PORT` 是 `number`，不用 `Number()` 轉）
- 缺欄位 → 啟動即掛、印清楚錯誤、K8s 看到 exit 1 會 restart 並亮紅燈
- 「prod 跑了 30 秒後第一個 request 才炸」這種地獄不會發生

**對應 12-Factor**：Factor 3 (Config) + Factor 9 (Disposability — fail-fast 也是 graceful 的一種)。

### 3.10 Client Component + Server Component 邊界

對應 Phase 3.10（Sprint 1 收尾時補的 mobile nav）。

**Next.js App Router 預設 Server Component**。需要互動 (state / event handler) 才轉 Client Component。**策略：把 Client 範圍縮到最小**。

**`'use client'` 指令**：
```tsx
'use client';   // 檔案最上面

import { useState } from 'react';   // 現在可以用 hooks 了
```

**Server / Client component 對照表**：

| 能用什麼 | Server | Client |
|---------|--------|--------|
| `async / await fetch / await db` | ✅ | ❌ |
| `useState / useReducer` | ❌ | ✅ |
| `useEffect` | ❌ | ✅ |
| `onClick / onChange` event handler | ❌ | ✅ |
| `import 'fs' / 'path'` (Node API) | ✅ | ❌ |
| `process.env.SECRET_*` (不對外洩) | ✅ | ❌（只能讀 NEXT_PUBLIC_* 開頭） |

**邊界設計準則**：
- Server 渲染父層（pages, layouts, 大部分 component）
- 把互動的小塊抽成 Client child component
- ❌ 整個 page 設 client → 失去 SSR / SEO 好處 + 額外送 JS 給瀏覽器

**範例（我們的 Header 結構）**：
```
<Header>             ← Server Component（純 render）
  <Link />             ← Server (Next.js Link 是 server-compat)
  <Link />
  <Link />
  <MobileMenu />     ← Client Component (useState + onClick)
</Header>
```

### 3.9 Pattern Reinforcement — US-04 Services

**沒新觀念，純練手。** 完全套用 3.8 的 pattern：

```
Repository → Service → Route        (backend)
Type → Fetcher → Component → Page   (frontend)
```

**新增小知識**：

| 主題 | 重點 |
|------|------|
| Prisma enum → JSON | Postgres enum 經 Prisma 變 string 出 API；前端用 union type (`'PREVENTIVE' \| ...`) 對接 |
| `Map<K,V>` 保持插入順序 | 用「先預建空 bucket」技巧固定 categoryGroups 顯示順序 |
| 「Service」這個字的命名衝突 | 業界共識：repository / service / model 都可能叫 ServiceXXX；接受疊字（`services.service.ts`） |
| `toLocaleString('zh-TW')` | 數字 1500 → "1,500" 千分位 |

### 3.8 Dynamic Routes + 404

**資料夾命名 `[id]` = 動態 segment**：
```
app/doctors/[id]/page.tsx     →  /doctors/anything
```

**Next 15+ params 是 Promise**（breaking change）：
```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;     // ✅ 一定要 await
}
```

**動態 SEO**：
```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { id } = await params;
  const doctor = await getDoctorById(id);
  return { title: `${doctor.name} ${doctor.title}` };
}
```

**404 處理**：
```tsx
import { notFound } from 'next/navigation';
if (!doctor) notFound();      // 自動 render Next 的 not-found 頁 + 回 HTTP 404
```

**Fastify typed route params**：
```ts
app.get<{ Params: { id: string } }>('/api/doctors/:id', async (req, reply) => {
  const doctor = await service.getDoctorById(req.params.id);  // ← 有型別
  if (!doctor) {
    reply.code(404);
    return { error: 'Doctor not found' };
  }
  return doctor;
});
```

---

## 常見踩雷集

### 🪤 PowerShell PATH 沒抓到新裝的 CLI

**症狀**：`gh : 無法辨識...` 或 `pnpm : 無法辨識...`

**原因**：你開的 PowerShell 視窗在 winget 裝套件前就開了，看不到新 PATH。

**修法 A（一次性）**：
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
```

**修法 B（永久）**：完全關閉 VS Code 與所有 terminal，重新打開。

### 🪤 PowerShell 跑不了 .ps1 (ExecutionPolicy)

**症狀**：`. : 因為這個系統上已停用指令碼執行...`

**修法**：用系統管理員開 PS 跑
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 🪤 .ps1 含中文跑出 ParseError

**症狀**：PowerShell parser 噴 `運算式或陳述式中有未預期的...` + 看到亂碼

**原因**：Windows PowerShell 5.1 不認 UTF-8 無 BOM 檔；用系統碼頁（CP950 / Big5）讀。

**修法**：把 .ps1 轉成 UTF-8 with BOM
```powershell
$utf8WithBom = New-Object System.Text.UTF8Encoding($true)
foreach ($f in @("scripts\setup-labels.ps1", "scripts\bootstrap-backlog.ps1")) {
  $full = Join-Path $PWD $f
  $content = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  [System.IO.File]::WriteAllText($full, $content, $utf8WithBom)
}
```

### 🪤 PowerShell 對含 UTF-8 的 API 回應顯示亂碼

**症狀**：`curl.exe ... | ConvertFrom-Json` 中文變 `?之??`

**修法**：用 `Invoke-RestMethod`（縮寫 `irm`）替代 `curl.exe + ConvertFrom-Json`：
```powershell
irm http://localhost:3001/api/doctors | Format-List
```

`irm` 自動處理 JSON + UTF-8。

### 🪤 PowerShell quoting 雷（傳 SQL 給 docker exec）

**症狀**：雙引號被吃掉，psql 報 `relation "doctor" does not exist`

**修法**：別在 PowerShell 鬥引號。改用互動 psql：
```powershell
docker exec -it dental-clinic-db psql -U dental -d dental
# 進去後直接打 SQL，不用 escape
```

### 🪤 `Select-Object | Format-Table` 對 `irm` 回 array 顯示空 row

**症狀**：`irm ... | Select name | ft` 印出 header 但沒資料

**原因**：PowerShell pipe 對 irm 回的 array 偶爾出包，把 array 當單一物件處理。

**修法**：用 `Format-List` 替代 `Format-Table`，並改用變數中介：
```powershell
$d = irm http://...
$d.Count          # 確認有幾筆
$d[0]             # 看單筆
$d | Format-List
```

### 🪤 第一次跑 docker compose 出現 unhealthy

**症狀**：`docker compose ps` 顯示 `(starting)` 很久或 `(unhealthy)`

**修法**：等 15–30 秒（Postgres 第一次初始化要時間），再 `ps` 一次。看 log：
```powershell
docker compose logs postgres --tail 20
```
最後一行應該是 `database system is ready to accept connections`。

### 🪤 PowerShell 5.1 不認識 `&&` / `||`

**症狀**：`在這個版本中 '&&' 語彙基元不是有效的陳述式分隔符號。`

**原因**：Bash / Linux shell 用 `cmd1 && cmd2` 串接，但 Windows PowerShell 5.1 不支援這個語法。PowerShell 7 (`pwsh`) 才支援。

**修法**：
- **無條件串接**：用 `;` 替代 `&&`
  ```powershell
  git switch main ; git pull ; git fetch --prune
  ```
- **條件串接**（前面成功才跑下一條）：
  ```powershell
  cmd1 ; if ($?) { cmd2 }
  ```
- **最直觀**：分行寫
  ```powershell
  git switch main
  git pull
  git fetch --prune
  ```
  好處：每行 output 立即看到，debug 容易。

### 🪤 Branch protection 擋下 push to main

**症狀**：`! [remote rejected] main -> main (push declined due to repository rule violations)`

**這是預期行為！** 表示保護有效。改走 PR 流程：
```powershell
git switch -c <feature-branch>
git push -u origin <feature-branch>
gh pr create --fill --base main
```

---

## 12-Factor 對應地圖

我們程式碼裡哪幾段對應到哪條 Factor：

| Factor | 哪裡 | 怎麼做 |
|--------|------|--------|
| 1. Codebase | 一個 Git repo | 整個 monorepo |
| 2. Dependencies | `package.json` engines + lockfile | `engines.node`, `packageManager`, pnpm-lock.yaml |
| 3. Config | env vars not code | `.env`、`process.env.*` |
| 4. Backing services | DB 是 attached resource | `DATABASE_URL` 可換 |
| 5. Build/Release/Run | 三 script 分離 | `build` (tsc) → `start` (node) |
| 6. Processes | stateless | API 無 session，state 在 DB |
| 7. Port binding | env 決定 port | `process.env.PORT` |
| 8. Concurrency | scale out | 之後 K8s replica |
| 9. Disposability | graceful shutdown | `server.ts` 處理 SIGTERM |
| 10. Dev/prod parity | 同 Postgres 16 | docker compose 鎖 image tag |
| 11. Logs as streams | stdout JSON | pino logger |
| 12. Admin processes | one-off scripts | `db:seed`, `db:migrate` |

---

## Git 完整指令清單

### 看狀態
```powershell
git status                       # 工作目錄狀態
git status --short               # 簡短版
git log --oneline -10            # 最近 10 個 commit 摘要
git log --oneline --all --decorate -10  # 含分支 ref
git diff                         # 看未 staged 改動
git diff --staged                # 看已 staged 改動
git branch -a                    # 看所有 branch（含遠端）
```

### Branch 管理
```powershell
git switch main                  # 切到 main
git switch -c feat/x             # 建 + 切到新 branch
git branch -d <name>             # 刪本地 branch（merged）
git branch -D <name>             # 強刪本地 branch（未 merged）
git fetch --prune                # 抓最新狀態 + 清掉遠端已刪的 ref
```

### Commit / 撤回
```powershell
git add .                        # stage 所有
git add <file>                   # stage 特定
git commit -m "..."              # commit
git reset --hard origin/main     # 本地強制對齊雲端 main（**不可逆**，會丟改動）
git reset --hard HEAD~1          # 退回前一個 commit（**不可逆**）
```

### Push / Pull
```powershell
git push                         # 推（已設 upstream）
git push -u origin <branch>      # 推 + 設 upstream
git pull                         # 拉
```

### gh CLI
```powershell
gh repo create <name> --public --source=. --remote=origin
gh pr create --fill --base main
gh pr list
gh issue list
gh issue list --label sprint:1 --state open
gh issue edit <N> --add-label <label>
gh api <endpoint>                # 直接打 GitHub REST API
```
