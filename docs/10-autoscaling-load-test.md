# API HPA 與 k6 展示

狀態：**configured, pending runtime verification**。已設定不等於已證明擴容；完整通過需保存 CPU、desired/current replicas、Pod Ready 與縮容時間序列。

## 架構與先決條件

`k8s/autoscaling` 是 opt-in Kustomize overlay，引用原有 base，新增 autoscaling/v2 HPA，並移除 API Deployment 的 `spec.replicas`，讓 HPA 管理副本數。base 仍維持固定 2 replicas，原有架構不變。

| 設定 | 值與理由 |
| --- | --- |
| min / max | 2 / 10；保留基本可用副本，限制資源與 DB connection 放大量 |
| CPU target | Average utilization 65%，分母是 CPU request，不是 limit |
| API resources | 保留 request 100m / 128Mi、limit 500m / 512Mi |
| Scale up | 30 秒 stabilization；每 60 秒最多增加 100% 或 2 Pod，選較小值 |
| Scale down | 300 秒 stabilization；每 60 秒最多減 1 Pod，避免短暫下降就頻繁縮放 |

必須先具備 Metrics Server（`metrics.k8s.io`）、API CPU request，以及足以讓平均 CPU 超過 65% 的負載。以 100m request 為例，65% 約等於每個 Pod 平均使用 65m；不是使用 65% 的整台主機。Prometheus 不會自動替代 Metrics Server。

```powershell
kubectl config current-context
kubectl get apiservice v1beta1.metrics.k8s.io
kubectl top pods -n dental-clinic
```

如果 APIService 不存在，先依 [Metrics Server 官方安裝文件](https://github.com/kubernetes-sigs/metrics-server#installation) 在自己的 demo cluster 安裝相容的固定版本；本次未自動修改叢集層級元件。不要為了展示而直接停用 kubelet TLS 憑證驗證。

節點需能容納最多 10 個 API Pods 與資料庫連線；`maxReplicas` 不會擴充 node。read-only catalog 可能主要等待 DB I/O，20 VUs 不保證 CPU 過門檻，不能為了看到擴容就宣稱不存在的結果。

## 部署順序

1. 確認專用 demo DB、Metrics Server、image pull 與資源容量，先跑低負載 smoke。
2. 依 [SHA 部署流程](06-kubernetes-deployment.md)建立 namespace/Secret、選定已發布 SHA、完成 migration。
3. 產生 release overlay 時，將 `resources: ../../../base` 改成 `../../../autoscaling`；保留 API/Web 的 SHA image transforms。不要直接以 latest 的 autoscaling overlay 上線。
4. 檢查產物再 apply，API 的 `spec.replicas` 應不存在、CPU request 仍是 100m、HPA 存在。首次切換副本管理時要在 demo 維護時段操作並觀察，之後持續從相同 overlay 部署，避免 base 將副本數重設成 2。

```powershell
# $releaseDir 來自前述 SHA 部署流程，先編輯其 app/kustomization.yaml resource。
kubectl kustomize "$releaseDir/app"
kubectl apply --dry-run=server -k "$releaseDir/app"
kubectl apply -k "$releaseDir/app"
kubectl -n dental-clinic rollout status deployment/api
kubectl -n dental-clinic describe hpa api
```

server dry-run 只檢查 API admission，不會安裝 HPA，也不證明 Metrics Server 可供應數據。

## 負載與觀察

先讀 [load-tests 使用方式](../load-tests/README.md)。k6 預設只對 `/api/doctors` GET，不建立預約；需要本機合成資料。不要將正式 API 透過本機 proxy 迴避 allowlist。不要使用 `--http-debug` 或記錄 response bodies。

HPA 展示使用叢集內 k6 Job 經 API Service 分配流量；不要用 `kubectl port-forward service/api` 當成多副本負載平衡測試。

同時開三個 terminal：

```powershell
kubectl get hpa -n dental-clinic -w
kubectl get pods -n dental-clinic -w
kubectl top pods -n dental-clinic
```

`top` 是單次快照，測試期間每隔 15–30 秒重複執行。另用下列指令查看 HPA 計算的 desired/current replicas：

```powershell
kubectl -n dental-clinic get hpa api -o jsonpath='{.status.currentReplicas}{" / "}{.status.desiredReplicas}'
kubectl -n dental-clinic describe hpa api
```

**預期現象（非本次已驗證結果）**：CPU 平均使用率上升 → 超過 target 且滿足控制器條件後 desired replicas 增加 → Deployment 建立新 Pod → readiness 成功後 Service 納入流量 → 降載後經 stabilization window 逐步縮回，最低 2。整個過程有採樣與啟動延遲，不會瞬間發生。

如果沒有擴容，依序確認 `TARGETS` 是否為 `<unknown>`、Metrics Server 狀態、CPU request、HPA conditions/events、平均 CPU 是否確實超標，以及是否受 maxReplicas、排程資源、image pull、DB readiness 或 DB bottleneck 限制。不要把等待 DB 導致的高 latency 誤判為 CPU 不足。

## 證據保存與成功條件

```powershell
New-Item -ItemType Directory -Force load-tests/results | Out-Null
kubectl -n dental-clinic get hpa api -o yaml > load-tests/results/hpa-before.yaml
# 在測試期間於另一個 terminal 執行；結束後 Ctrl+C
kubectl -n dental-clinic get hpa api -w | Tee-Object load-tests/results/hpa-watch.txt
# 測試後
kubectl -n dental-clinic get hpa api -o yaml > load-tests/results/hpa-after.yaml
kubectl -n dental-clinic get pods -o wide > load-tests/results/pods-after.txt
kubectl -n dental-clinic describe hpa api > load-tests/results/hpa-describe.txt
```

另記錄開始／結束時間、git SHA、image digest、CPU request/limit、節點容量、DB 規模、k6 profile/VUs、原始 summary、CPU 快照與至少 5–10 分鐘的降載觀察。檔案保存在 gitignored results，審查後才能引用其彙總。

完整驗收需同時記錄 CPU 超標、desired/current 增加、新 Pod Ready 與降載後縮容；一次 k6 smoke 成功或 server dry-run 不足以驗證 HPA。p95 < 500ms 是測試 threshold，並非已量測的容量成果。目前狀態仍為 Configured, pending runtime verification。

依據：[Kubernetes HPA](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)、[k6 options](https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/)、[k6 thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)。
