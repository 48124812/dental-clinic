<!--
對應講義：12-Factor SDLC P.73「PR/MR best practices」、P.74「Review checklist」。
請完整填寫，幫助 reviewer 快速理解這個變更的意圖與風險。
-->

## What — 改了什麼

<!-- 一段話描述這個 PR 做了什麼。寫給 6 個月後的自己看。 -->

## Why — 為什麼改

<!-- 連結到 Issue：closes #N、refs #N。
     如果是 bug fix，描述根因（root cause）。
     如果是 feature，連結 User Story。 -->

Closes #

## How — 怎麼做的

<!-- 重點設計決策：用了哪個模式、為什麼選 A 不選 B。
     避免列出所有改動的檔案（reviewer 看 diff 就知道），講「設計」。 -->

## Test Plan

<!-- 怎麼驗證這個 PR 是對的。reviewer 也可以照這份重做驗證。 -->

- [ ]
- [ ]

## Cloud-Native Checklist (對應 12-Factor SDLC P.74)

- [ ] Config/secrets 都來自 env 或 secret manager，沒寫死在 code
- [ ] Log 寫到 stdout/stderr，沒寫到本機檔案
- [ ] 外部呼叫有 timeout / retry 設定
- [ ] Idempotent（重複呼叫安全）
- [ ] API / DB 變更向後相容（backward-compatible）
- [ ] 有對應的測試（unit / integration / E2E 至少一種）
- [ ] PR 大小小於 ~400 行（除非有理由）

## Rollout / Rollback Notes (有風險的變更才填)

<!-- 例如：DB migration 需要先跑、需要新環境變數、需要先部署 backend 再部署 frontend。
     描述如果壞掉怎麼回退。 -->

## Screenshots / Demos (UI 變更才需要)

<!-- Before / After 截圖。 -->
