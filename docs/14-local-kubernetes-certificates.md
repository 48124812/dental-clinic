# 專用 Kubernetes 測試叢集與 kubelet 憑證

本指南使用 Docker Desktop 提供的 Docker Engine，另外建立 **kind `dental-hpa-lab`**。不重設既有 Docker Desktop Kubernetes、不修改 `dental-clinic` 部署、不連 Render DB。目的只在解決 Metrics Server 的 kubelet TLS 驗證問題，為後續 HPA 實驗準備環境。

憑證驗證後的應用／HPA 部署已另行完成，最新環境與本機入口見[部署指南](15-local-kubernetes-demo.md)；下方實際結果記錄的是憑證修正當下的範圍。

## 原因與修正

先前 Docker Desktop kubelet serving certificate 缺少 IP SAN，Metrics Server 以節點 IP 連線時無法驗證伺服器身分。只有改用 HTTPS 或加入 CA 並不能補上缺少的 SAN。

本實驗在新叢集採用：

1. kubelet 設定 `serverTLSBootstrap: true`，向叢集提出 serving certificate CSR。
2. 維護者核對 requester、subject、用途及 SAN，只批准已確認的單筆 CSR。
3. Kubernetes signer 簽發包含該節點 DNS 與 InternalIP 的憑證。
4. Metrics Server 明確使用叢集 CA：`--kubelet-certificate-authority=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`。

**未使用 `--kubelet-insecure-tls`。** 本次修正的是 Metrics Server → kubelet 的信任與名稱驗證。上游 Metrics Server 安裝檔的 APIService 仍保留 `insecureSkipTLSVerify: true`，這是 API aggregation → Metrics Server 的另一條 TLS 路徑；本輪沒有加固該路徑，不能宣稱整個叢集已完成正式環境 TLS 強化。

## 版本與檔案

| 項目 | 固定設定 |
| --- | --- |
| kind | v0.31.0，Windows amd64 官方 binary，下載後核對官方 SHA256 |
| Kubernetes | v1.34.3，node image digest 固定於 `k8s/local-kind/cluster.yaml` |
| Metrics Server | v0.8.1，上游 release 加上 CA 參數，見 `k8s/local-kind/metrics-server/` |
| 叢集名稱／context | `dental-hpa-lab`／`kind-dental-hpa-lab` |
| 私人工具與 kubeconfig | `.private/kind-lab/`，Git ignored；kubeconfig 包含存取憑證，不可公開 |

此目錄刻意不加入 `k8s/base`、`observability` 或 `autoscaling`；一般應用程式部署不應意外建立叢集或修改系統元件。單節點環境用於學習，不提供多節點高可用性。

## 重建步驟（PowerShell，repository 根目錄）

2026-10-09 已實際建立此叢集。**已有叢集時從第 4 節檢查即可，不要重跑建立或刪除。** 所有 `kubectl` 命令都明確指定私人 kubeconfig 與 context，不需切換預設 context。

### 1. 下載並核對 kind

```powershell
New-Item -ItemType Directory -Force .private/kind-lab | Out-Null
Invoke-WebRequest -UseBasicParsing https://github.com/kubernetes-sigs/kind/releases/download/v0.31.0/kind-windows-amd64 -OutFile .private/kind-lab/kind.exe
Invoke-WebRequest -UseBasicParsing https://github.com/kubernetes-sigs/kind/releases/download/v0.31.0/kind-windows-amd64.sha256sum -OutFile .private/kind-lab/kind.sha256
$expected = ((Get-Content .private/kind-lab/kind.sha256 -Raw).Trim() -split '\s+')[0]
if ((Get-FileHash .private/kind-lab/kind.exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.ToLowerInvariant()) {
    throw 'kind checksum mismatch'
}
.private/kind-lab/kind.exe version
```

不需要修改 PATH 或安裝到系統資料夾。下載失敗時停止，不執行未通過 checksum 的程式。

### 2. 建立新叢集

```powershell
.private/kind-lab/kind.exe get clusters
# 若 dental-hpa-lab 已存在，停止並先檢查現況。
if (Test-Path .private/kind-lab/kubeconfig) { throw 'Inspect existing lab before reuse' }
.private/kind-lab/kind.exe create cluster --name dental-hpa-lab `
  --config k8s/local-kind/cluster.yaml `
  --kubeconfig .private/kind-lab/kubeconfig --wait 120s
if ($LASTEXITCODE -ne 0) { throw 'Cluster creation failed' }

$labArgs = @('--kubeconfig', '.private/kind-lab/kubeconfig', '--context', 'kind-dental-hpa-lab')
kubectl @labArgs get nodes -o wide
kubectl @labArgs get csr
```

API server 綁定本機 `127.0.0.1`，不公開到外部。kind 只寫指定的 kubeconfig，原本預設 context 不變。節點 IP、CSR 名稱每次建立都可能不同。

### 3. 審查並批准 kubelet serving CSR

Serving CSR 不會被 Kubernetes 內建 approver 自動批准。啟動時可能出現多筆，應選最新且與目前節點相符的一筆，**不要使用 approve --all 或直接批准所有 Pending CSR**。

```powershell
$labArgs = @('--kubeconfig', '.private/kind-lab/kubeconfig', '--context', 'kind-dental-hpa-lab')
$csrName = '<本次待審查的實際 CSR 名稱>'
$csrJson = kubectl @labArgs get csr $csrName -o json
if ($LASTEXITCODE -ne 0) { throw 'Cannot read CSR' }
$csr = $csrJson | ConvertFrom-Json
$csr.spec | Select-Object signerName, username, groups, usages
kubectl @labArgs get node dental-hpa-lab-control-plane -o wide
[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($csr.spec.request)) |
  docker exec -i dental-hpa-lab-control-plane openssl req -noout -verify -text
```

必須逐項核對：

- signer 為 `kubernetes.io/kubelet-serving`。
- requester 與 subject CN 均為 `system:node:dental-hpa-lab-control-plane`；subject O 為 `system:nodes`。
- requester groups 為預期的 `system:nodes`、`system:authenticated`，不是不明身分。
- 用途為 server auth 與對應金鑰用途；本次 EC 金鑰是 `digital signature`、`server auth`，不含 client auth 或其他額外用途。
- request self-signature 驗證成功；SAN 只含該節點名稱與實際 InternalIP，不含其他 IP、DNS 或 URI。

全部符合後，才執行下列單筆批准；若不符合先停止調查：

```powershell
kubectl @labArgs certificate approve $csrName
kubectl @labArgs get csr $csrName
docker exec dental-hpa-lab-control-plane openssl x509 `
  -in /var/lib/kubelet/pki/kubelet-server-current.pem `
  -noout -subject -issuer -ext subjectAltName -dates

$nodeJson = kubectl @labArgs get node dental-hpa-lab-control-plane -o json
if ($LASTEXITCODE -ne 0) { throw 'Cannot read node' }
$node = $nodeJson | ConvertFrom-Json
$nodeIP = ($node.status.addresses | Where-Object type -eq 'InternalIP').address
docker exec dental-hpa-lab-control-plane openssl verify `
  -CAfile /etc/kubernetes/pki/ca.crt -verify_ip $nodeIP `
  /var/lib/kubelet/pki/kubelet-server-current.pem
```

預期 CSR 為 Approved,Issued，最後憑證驗證為 `OK`。不要輸出或複製 `ca.key`、kubelet 私鑰或 kubeconfig 內容；上方 openssl 命令只輸出公開憑證資訊。

### 4. 安裝 Metrics Server 並驗證

```powershell
$labArgs = @('--kubeconfig', '.private/kind-lab/kubeconfig', '--context', 'kind-dental-hpa-lab')
kubectl kustomize k8s/local-kind/metrics-server > .private/kind-lab/metrics-server-rendered.yaml
if ($LASTEXITCODE -ne 0) { throw 'Cannot render Metrics Server' }
kubectl @labArgs apply -f .private/kind-lab/metrics-server-rendered.yaml
if ($LASTEXITCODE -ne 0) { throw 'Metrics Server apply failed' }
kubectl @labArgs -n kube-system rollout status deployment/metrics-server --timeout=120s
if ($LASTEXITCODE -ne 0) { throw 'Metrics Server not Ready; inspect logs' }
kubectl @labArgs wait --for=condition=Available apiservice/v1beta1.metrics.k8s.io --timeout=60s
if ($LASTEXITCODE -ne 0) { throw 'Metrics API not Available' }
kubectl @labArgs top nodes
kubectl @labArgs top pods -A
kubectl config current-context
```

Pod Ready 與 API discovery 之間可能短暫顯示 Metrics API not available，先等待 APIService Available。若仍失敗，查看新叢集的 Metrics Server Logs、CSR 狀態與憑證驗證，不增加 insecure 參數。

## 2026-10-09 實際結果

- 新叢集 node Ready；`serverTLSBootstrap: true` 已生效。
- 審查兩筆初始 serving CSR 的公開內容後，只批准最新的一筆；另一筆沒有批次批准。
- kubelet serving certificate issuer 為叢集 CA `kubernetes`，包含節點 DNS 與 InternalIP，`openssl verify -CAfile ... -verify_ip ...` 回 `OK`。
- Metrics Server rollout 通過，APIService Available=True；`kubectl top nodes` 與 `kubectl top pods -A` 均成功。
- 初次在 API discovery 尚未完成時查 top 失敗；等待 Available 後重查通過，沒有停用 kubelet TLS 驗證。
- 預設 context 仍為 `docker-desktop`，既有牙醫網站部署沒有修改。
- 專用叢集與 Metrics Server **保留運行**供下階段使用；本輪未部署牙醫 API、Database 或 HPA 到新叢集，未加壓，HPA 擴縮仍待驗證。

## 維護與清理

Serving certificate 會到期／輪替，後續 CSR 仍需重新核對後批准。本次沒有安裝自動 CSR approver；重建叢集或節點位址改變後，也不能沿用舊 CSR／IP。若採用自動 approver，必須另行設計節點身分與 SAN 驗證策略。

本叢集與 Docker Desktop 共用主機 CPU／記憶體；不是獨立硬體的效能測試環境。完成所有後續實驗、確認不需保留其中資料後，才可清理：

```powershell
.private/kind-lab/kind.exe delete cluster --name dental-hpa-lab `
  --kubeconfig .private/kind-lab/kubeconfig
```

這會刪除專用叢集及其所有資料，不能當作日常停止指令；不要改成其他叢集名稱。工具下載、Git ignored 證據與共用 Docker image cache 不會由此自動刪除。

來源：[kind Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)、[固定版本與 node digest](https://github.com/kubernetes-sigs/kind/releases/tag/v0.31.0)、[kubeadm certificate management](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)、[TLS bootstrapping](https://kubernetes.io/docs/reference/access-authn-authz/kubelet-tls-bootstrapping/)、[Metrics Server FAQ](https://github.com/kubernetes-sigs/metrics-server/blob/master/FAQ.md)。
