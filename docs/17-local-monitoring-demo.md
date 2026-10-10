# 本機 Prometheus／Grafana 展示

本頁只適用於專用 `kind-dental-hpa-lab` 叢集。沒有操作 Render，沒有啟動高負載測試。Dashboard 使用既有設定，沒有開啟匿名登入。

## 開啟畫面

在 repository 根目錄的 PowerShell 執行；每條 port-forward 使用獨立視窗，保持程序運作。若同一個 port 已有此次轉送程序，不要重複啟動。

```powershell
kubectl --kubeconfig .private/kind-lab/kubeconfig --context kind-dental-hpa-lab -n dental-clinic port-forward --address=127.0.0.1 service/prometheus 19090:9090
kubectl --kubeconfig .private/kind-lab/kubeconfig --context kind-dental-hpa-lab -n dental-clinic port-forward --address=127.0.0.1 service/grafana 13000:3000
kubectl --kubeconfig .private/kind-lab/kubeconfig --context kind-dental-hpa-lab -n dental-clinic port-forward --address=127.0.0.1 service/lab-gateway 18080:8080
```

- Prometheus：<http://127.0.0.1:19090/targets>，確認兩個 API target 都是 UP；不同版本可從選單進入 Targets。
- Grafana：<http://127.0.0.1:13000/>，登入後在 Dashboards 開啟 **Dental Clinic API Overview**。時間範圍選 Last 30 minutes，Refresh 選 5s。要看過去實驗請選實際測試時間，不要把當前空閒狀態當成過去負載結果。
- 本機網站：<http://127.0.0.1:18080/>，瀏覽醫師與療程可產生少量唯讀請求。

Grafana 帳密來自本機 `grafana-secret`。本輪在 Git ignored 的 `.private/kind-app/copy-grafana-login.ps1` 提供輔助腳本：從專案根目錄執行 `& .\.private\kind-app\copy-grafana-login.ps1 -Field Username`，貼到登入帳號欄，再用 `-Field Password` 複製密碼。腳本只將值放入本機剪貼簿，不顯示密碼；此 ignored 腳本不是公開 repository 的必要檔案。不要將 Secret YAML、密碼或剪貼簿截圖貼到對話或 Git。登入後執行 `Set-Clipboard -Value ''` 清除目前剪貼簿；若使用 Windows 剪貼簿歷程，也要清除該筆紀錄。

## 圖表怎麼看

若是新 clone、沒有上述私人輔助腳本，可在自己的專用 lab 用以下方式將密碼複製到剪貼簿；帳號使用建立 Grafana Secret 時選定的名稱。命令不顯示密碼，請勿自行輸出 `$labSecret`。取得 Secret 的權限只供環境維護者使用，不提供給公開網站訪客。

```powershell
$labSecretJson = kubectl --kubeconfig .private/kind-lab/kubeconfig --context kind-dental-hpa-lab -n dental-clinic get secret grafana-secret -o json
if ($LASTEXITCODE -ne 0) { throw 'Cannot read lab Grafana Secret' }
$labSecret = ($labSecretJson -join "`n") | ConvertFrom-Json
Set-Clipboard -Value ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($labSecret.data.GF_SECURITY_ADMIN_PASSWORD)))
Remove-Variable labSecret,labSecretJson
# 貼入本機 Grafana 密碼欄後清除剪貼簿。
```

| Panel | 意義與展示方式 |
| --- | --- |
| API request rate | 所有 API replicas 的每秒應用請求，使用 5 分鐘 rate；探針與 metrics 不計入。少量請求後會逐漸升高，不一定等於發送器當下速率。 |
| API 5xx error ratio | 應用請求中伺服器錯誤比例。本輪為 0；完全沒有流量時可能 NaN／無資料，不能視為零錯誤的證明。 |
| API p95 request latency | 由伺服器 histogram buckets 估算的 95 百分位；單位秒，與包含網路時間的 k6 latency 不同。 |
| API process CPU usage | 每個 API Process 使用的 CPU，圖表百分比以一個 CPU core 為分母。不是 HPA 的 CPU request 利用率，也不是整台 Node 使用率。 |
| API process resident memory | 每個 API Process 的 RSS，不是 Pod 的完整記憶體或 memory limit 百分比。 |

在 Prometheus 的查詢畫面執行 `up{job="dental-clinic-api"}`，每個 target 的值應為 1。這表示 metrics 抓取成功，不等於所有業務流程都通過。

Alert Rules 可從 Prometheus 選單查看：`DentalClinicApiDown` 與 `DentalClinicHighServerErrorRate`。後者要求 5xx ratio > 5% 持續 5 分鐘。規則載入與 inactive 狀態不代表已測試告警觸發或外部 Email 送達。

## 本輪實際驗證（2026-10-11）

- API 2/2 Ready，HPA 保持 65%；Prometheus 與 Grafana Ready。
- Grafana health HTTP 200、資料庫狀態 ok；既有 Dashboard 五個 Panel 的查詢都有數值。
- 兩個 API metrics targets 都為 UP；另外使用 Grafana datasource proxy 查詢 `up` 成功，確認不是只有直接存取 Prometheus 才能取得資料。
- 約每秒一次，總共 90 次 GET 本機 gateway `/api/doctors`，全部 HTTP 200；沒有寫入預約資料。這是展示用流量，不是 k6 壓測或 Capacity Test。
- 結束後單次查詢快照：request rate 約 0.616 req/s、5xx ratio 0、histogram p95 約 4.777 ms。兩個 Process CPU 約為一個 core 的 0.305%／0.266%，RSS 約 101.02／93.68 MiB。這些是特定窗口快照，不是容量或長期 SLO 數據。
- 兩條 Alert Rules health=ok、state=inactive；沒有驗證外部收件人送達。
- 原始 API 驗證摘要位於 ignored `load-tests/results/monitoring-20261011/verification.json`。已驗證 Dashboard 與資料來源 API，尚未以瀏覽器自動化驗證畫面或保存 Grafana 截圖。

## HPA 與限制

目前 Prometheus 沒有 `kube_horizontalpodautoscaler_*` 或 `kube_deployment_status_replicas` 資料，既有 Dashboard 不顯示 HPA 副本數。Metrics Server 提供 HPA 所需資源指標，不會自動把 HPA 狀態加入 Prometheus。若要新增此類圖表，需另外評估 kube-state-metrics 與相應 scrape 設定；本輪未新增。

可並排使用專用 kubeconfig 的 `kubectl get hpa -n dental-clinic -w`／`kubectl get pods -n dental-clinic -w`，或展示[已保存的降低門檻實驗](16-local-load-observation.md)。不要把現在的 2 個副本描述為正在擴容。容器計時差異仍待調查，不宣稱已驗證正式容量。

Port-forward 只綁定 127.0.0.1，同一台電腦能開啟；電腦休眠、Pod 重建或轉送程序停止後可能需要重新啟動。停止手動轉送時在對應視窗按 Ctrl+C；本輪背景程序的 PID 記錄於 ignored `.private/kind-app/*-forward.pid`，停止前應核對程序仍是對應 kubectl，不可只依舊 PID 結束程序。Prometheus 歷史資料的持久性不在本次驗證範圍。
