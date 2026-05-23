# ADR-0007: Split `/health` and `/ready` for K8s probes

- **Status**: Accepted
- **Date**: 2026-05-24
- **Phase**: 4.3

## Context
原本只有 `/health` endpoint，永遠回 200。K8s 部署上線後，liveness 與 readiness 行為完全不同：
- **Liveness 失敗** → K8s **kill + restart** pod
- **Readiness 失敗** → K8s **暫時從 service endpoint 移除**（不重啟）

如果只有一個 endpoint 同時做 liveness + readiness：DB 短暫斷線 → liveness fail → K8s 把全部 pod 殺光 → 雪崩。

對應 Observability 講義 P.99–103。

## Decision
- `GET /health` (Liveness)：**永遠回 200**（除非 process 卡死）。**禁止查 DB / 第三方 API**
- `GET /ready` (Readiness)：實際 ping DB (`SELECT 1`)，失敗回 **503**（不是 500）
- 503 = Service Unavailable，語意是「我暫時不行，請 retry」
- 500 = Internal Server Error，語意是「我壞了」

## Consequences
**好處**：
- DB blip 不會觸發 pod restart 雪崩
- K8s `readinessProbe` 與 `livenessProbe` 各自指向對的 endpoint
- 503 status code 讓 LB / cache / client retry policy 正確運作

**壞處**：
- 多一個 endpoint 要維護
- Readiness 加新依賴 (cache、downstream API) 時，要小心別讓檢查變慢或不穩

## Alternatives considered
- **單一 /health 兼任兩者**：K8s 不知差別 → 上述雪崩風險
- **/health 含 deep check (DB / cache)**：違反 liveness 鐵則
- **客戶端不打 health，K8s 用 TCP socket probe**：太弱，看不到應用層健康

## Revisit when
- Readiness check 變慢（> 500ms）→ 改成非同步 + cache 結果
- 加多個依賴（cache, message queue, downstream API）→ readiness 內部要逐項回報、有的可選有的必選
- 上 K8s 後實測發現 probe 行為不如預期 → 調 timeout / interval / failureThreshold
