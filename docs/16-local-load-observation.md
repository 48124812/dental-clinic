# 專用 kind 漸進負載與 HPA 觀察

本機圖表入口、登入方式與 CPU 指標解讀請見 [Prometheus／Grafana 展示](17-local-monitoring-demo.md)。

> 最新結果（2026-10-11）：暫時將 CPU target 從 65% 降為 10%，已觀察到 2 → 3 → 4 個 Ready Pod；停止負載並恢復 65% 後，自動縮回 2 個。這是本機降低門檻的機制驗證，不代表原本 65% 設定已在負載下觸發擴容，也不是容量測試。

本實驗只使用 `kind-dental-hpa-lab`、合成資料庫與叢集內 API Service，不測試 Render。先完成[本機部署與 Smoke Test](15-local-kubernetes-demo.md)，才能執行本頁負載；每次都要重新確認資料庫與 API Ready。

## 測試設計

- 腳本：`load-tests/read-only.js`；image：`grafana/k6:1.0.0`。
- 只 GET `/api/doctors`，不寫預約、不儲存 response body、不跟隨 redirect。
- PROFILE=ramp、PEAK_VUS=20：0→5（1 分鐘）→10（2 分鐘）→20（2 分鐘）→保持 20（3 分鐘）→0（2 分鐘），總設定時間 10 分鐘。
- 每個 virtual user 在每次請求後 sleep 1 秒；20 VU 不代表 20 個 CPU worker，也不保證固定 20 RPS。
- Threshold：HTTP error rate < 1%、p95 < 500 ms、checks > 99%。持續 HTTP 失敗可由腳本 abort；其餘門檻依 k6 結果判定。
- HPA 沿用原設定：100m CPU request、65% utilization、2–10 replicas；沒有為了看到擴容而降低 CPU request／target，也不製造 CPU busy loop。
- 每約 20 秒保存 CPU utilization、HPA desired/current、Ready Pod、UID、restart count 與節點／Pod CPU、記憶體；負載結束後再觀察至少 5 分鐘。

## 執行前與停止條件

```powershell
$labArgs = @('--kubeconfig', '.private/kind-lab/kubeconfig', '--context', 'kind-dental-hpa-lab')
kubectl @labArgs get nodes
kubectl @labArgs -n dental-clinic get deployments,hpa
kubectl @labArgs -n dental-clinic get endpointslice -l kubernetes.io/service-name=lab-db
kubectl @labArgs -n dental-clinic top pods
kubectl @labArgs top nodes
```

只有一個有效的 lab DB endpoint、API Ready、Metrics API 可用才開始。若暫存 DB 已停止，先排查／恢復，不能帶著已知錯誤開始壓測。既有測試資料若需要保留，不要直接重建資料庫。

本輪操作腳本在沒有 Ready API、DB endpoint 異常、節點 CPU 達 80% 或記憶體達 85%、節點出現 Memory/Disk/PID pressure 時停止。這些是保護本機的實驗停止條件，不是正式 SLO。k6 Job 另有 720 秒 deadline、backoffLimit=0，避免自動重跑。

## 手動重現既有 Job

先建立唯一名稱，避免覆寫或刪除其他測試：

```powershell
New-Item -ItemType Directory -Force load-tests/results | Out-Null
$runName = 'k6-ramp-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$runDir = "load-tests/results/$runName"
New-Item -ItemType Directory $runDir | Out-Null
kubectl @labArgs -n dental-clinic create configmap $runName --from-file=read-only.js=load-tests/read-only.js
if ($LASTEXITCODE -ne 0) { throw 'Script ConfigMap creation failed' }
$jobJson = kubectl create --dry-run=client -f load-tests/k6-job.yaml -o json
if ($LASTEXITCODE -ne 0) { throw 'Cannot render Job' }
$job = ($jobJson -join "`n") | ConvertFrom-Json
$job.metadata.name = $runName
($job.spec.template.spec.volumes | Where-Object name -eq 'scripts').configMap.name = $runName
$job | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 "$runDir/job.json"
# Review BASE_URL/profile/VUs in this file before creating the Job.
kubectl @labArgs create -f "$runDir/job.json"
```

必須使用專用 kubeconfig；同名 Service 在另一個 context 可能連到其他 DB。原有 Job 已明確指定內部 API URL 與 20 VU，不把它改成 Render，也不透過 localhost proxy 繞過腳本 allowlist。

負載期間在另一個 PowerShell 視窗觀察（重新設定同一份 `$labArgs`）：

```powershell
kubectl @labArgs -n dental-clinic get hpa api -w
# 另開視窗使用相同 labArgs：
kubectl @labArgs -n dental-clinic get pods -w
kubectl @labArgs -n dental-clinic top pods
```

上述手動命令**沒有自動執行資源中止邏輯**，操作者需持續觀察停止條件；需要提前停止時只刪除本次 `$runName` Job。原始自動採樣／中止 wrapper 保留在本機 ignored 目錄，不能把手動命令誤認為帶有相同保護。

完成後保存 Job／Pod exit code 與 logs 中 `K6_SUMMARY_JSON_BEGIN/END` 之間的摘要，再清理本次 Job 與 ConfigMap。不要刪除整個 namespace 或資料庫。即使 k6 通過，也要觀察負載結束後的副本與資源變化。

## 如何解讀

負載與 Threshold 通過只證明這個測試設定在本次環境可運行；單節點、共享主機、少量合成目錄與唯讀查詢都限制了結果的代表性。

要證明 HPA 擴縮，必須同時觀察 CPU 超標、desired/current 增加、新 Pod Ready，以及降載後縮回。若 CPU 一直低於目標且副本維持 2，應記錄為「此負載未觸發擴容」，不是 HPA 故障，也不是擴縮成功。更不能把 p95 門檻當成網站最大容量。

## 2026-10-10 k6 結果

本輪使用 API 映像 `sha-0d8a1757a0232add134dc407f490eafb6e6f1441`；資料庫為上一輪恢復後的合成目錄。進行前確認 API DB host／database 僅指向專用 lab、`/ready` 200、4 位合成醫師與單一有效 DB endpoint。未修改 CPU request、HPA 門檻或負載腳本。

| 項目 | k6 實際輸出 |
| --- | --- |
| Job／run ID | `ramp-20261010-244e74dd` |
| 峰值 VU | 20 |
| HTTP requests／checks | 7,551 次；7,551 checks 通過、0 失敗 |
| HTTP error rate | 0% |
| request duration | avg 1.718 ms、p95 2.213 ms、max 9.856 ms |
| 三個 Threshold／程序 | 全部通過；exit code 0，0 interrupted iterations |
| 離線安全測試 | 本輪 `pnpm test:load-config`：13 通過 |

**時間量測限制：** scenario 顯示完成設定的 `10m0s`，但 k6 的 running elapsed 顯示 `09m14.4s`；容器 `startedAt=2026-10-09T18:30:50Z`、`finishedAt=2026-10-09T18:40:04Z` 也約為 9 分 14 秒（台北日期均為 10 月 10 日）。這個差異原因未確認。不能把本次宣稱為已驗證精確 600 秒的壓測，也不能據 `http_reqs.rate=13.619/s` 推論系統吞吐上限。上表延遲與請求數只是該次 k6 報告值；再次作效能基準前需先檢查主機／VM／容器的計時一致性。

負載中另外向 Prometheus 查詢一分鐘窗口，取得約 15.42 req/s 與 0 的 5xx ratio；這是單次窗口快照，不是全程平均，也不與 k6 rate 直接等同。

原始 `k6.log`、`summary.json`、`metadata.json`、容器時間、HPA／節點資訊與 `telemetry.jsonl` 均在 Git ignored 的 `load-tests/results/ramp-20261010-244e74dd/`。公開文件只引用彙總，原始產物不提交。

### HPA 與負載後觀察

整段測試與負載後觀察共保存 44 筆採樣，約每 20 秒一筆；負載結束後以 host monotonic clock 等待至少 300 秒並持續採樣。

| 指標 | 觀測結果 |
| --- | --- |
| HPA CPU utilization 最高採樣值 | 23%，低於 target 65% |
| desired／current replicas | 全部採樣皆為 2 |
| API Ready | 全部採樣皆為 2 |
| Pod 身分／重啟 | 始終是同兩個 UID，restart count 均維持既有的 1，沒有採樣到增加 |
| 節點 CPU／記憶體 | 採樣最高約 0.84%／8.25%，沒有碰到資源停止條件 |
| 負載後 CPU | 約 2–3%，最後為 3% |
| Scale Up／Scale Down | 未觀察到；因沒有擴容，也沒有可驗證的降載縮容過程 |

結論：**此次 20 VU 唯讀負載的回應與 Threshold 通過，HPA 指標可讀，但沒有觸發擴容。** 未證明更高負載下的自動擴縮或系統最大容量。20 秒離散採樣不是每一瞬間的完整紀錄，不能據此額外宣稱絕對零中斷；時間量測差異仍需另行調查。

已確認本次 Job／Pod／ConfigMap 刪除；API/Web、資料庫、HPA 與監控保留 Ready。未改動 API 程式、HPA target、資料庫結構、Render 或原本 Docker Desktop context；未 Commit／Push。

下一輪建議先確認 VM／容器計時一致性與暫存 DB 的恢復方式，再根據實際 CPU／DB 餘裕決定是否提高負載。不要透過降低 CPU request、縮短 scale-down window 或加入無關 CPU 計算來包裝成原本工作負載的擴縮成果。

## 2026-10-11 降低門檻的 HPA 機制驗證

本輪由使用者授權暫時降低 target，結束後恢復。只使用 `kind-dental-hpa-lab`，未操作 Render、正式資料庫或原本 Docker Desktop 叢集。

### 環境恢復與前置檢查

- 節點重啟後 IP 從 `172.20.0.5` 改為 `172.20.0.4`，Metrics Server 因舊 kubelet 憑證 SAN 不符而無法取得指標。核對 `csr-wd9ph` 的 signer、節點身分、用途與新 IP SAN 後核准，Metrics Server 恢復 Ready；沒有關閉 kubelet TLS 驗證。
- 兩個既有暫存 DB Pod 都已 Failed，Service 沒有可用 Endpoint。保留舊 Pod，建立 `lab-db-recovery-20261011-2fa9eb3e`，使用既有 Migration 與 Seed 初始化全新合成資料。這不是資料還原；暫存資料庫仍會受到重啟影響。
- 確認 API 的 DB host/database 指向隔離環境、`/ready` 回傳 200、醫師目錄有 4 筆合成資料、API 2/2 Ready。Migration／Seed Job 完成後清除。
- `pnpm test:load-config`：13 項通過。首次執行受本機權限限制，取得執行權限後重跑通過。

### 測試設定與實際結果

Run ID：`mechanism-20261011-795648e3`。沿用 API SHA image `0d8a1757a0232add134dc407f490eafb6e6f1441`。

唯一 HPA 設定變更為 CPU target **65% → 10% → 65%**。CPU request 保持 100m，min/max 保持 2/10，scale-up 30 秒與 scale-down 300 秒穩定窗口、每 60 秒最多縮 1 個 Pod 均不變。

負載使用既有唯讀腳本及安全限制，僅縮短 stages：30s/5 VU → 30s/10 VU → 30s/20 VU → 2m/20 VU → 30s/0 VU。只 GET 叢集內 `/api/doctors`，每次迭代 sleep 1 秒，不建立預約。

| 項目 | 實際結果 |
| --- | --- |
| HTTP requests / checks | 3,423 次，checks 全部通過 |
| HTTP error rate | 0% |
| p95 | k6 報告約 2.784 ms |
| Threshold / exit code | 全部通過 / 0 |
| 擴容 | 2 → 3 → 4，新增 Pod 已 Ready |
| Kubernetes 事件 | `SuccessfulRescale`，原因為 CPU utilization 超過 target |
| 恢復後縮容 | 4 → 3 → 2，最終 API 2/2 Ready |
| 設定還原 | 完整 HPA spec 與測試前備份相同，target 65% |
| 清理 | 本輪 k6 Job、Pod、ConfigMap 已刪除；保留應用與合成 DB |

採樣中約第 125 秒看到 3 個 Ready Pod、第 202 秒看到 4 個。負載完成後恢復 65%，約第 520 秒縮到 3 個、第 581 秒回到 2 個，並再採樣確認。這些是 wrapper 的 monotonic elapsed 採樣時間，並非事件精確發生時間。縮容是在「停止負載且恢復 target」之後觀察到，不能歸因於單一變因。

**計時限制仍存在：** stages 設定總長 240 秒，但 k6 最終 elapsed 約 3m41s，容器 `startedAt=2026-10-10T18:08:05Z`、`finishedAt=2026-10-10T18:11:46Z`（台北日期為 10 月 11 日）。原因未確認，不將此結果作為精確時長或容量基準。這不抹除已保存的 HPA 擴縮與 Pod Ready 證據，但不能外推正式環境效能。

原始 summary、telemetry、HPA 備份、事件與清理結果保存在 Git ignored 的 `load-tests/results/mechanism-20261011-795648e3/`；執行 wrapper 位於 ignored 的 `.private/kind-app/hpa-mechanism.mjs`。公開文件只保留彙總。未 Commit、Push，未改動正式 HPA manifest。
