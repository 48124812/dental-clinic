# =============================================================================
# scripts/setup-labels.ps1
# =============================================================================
# 為 dental-clinic repo 建立一致的 GitHub Labels。
#
# 對應講義：Agile P.47–48「Product Backlog」、P.49「Sample of Product Backlog」。
#
# Labels 是 GitHub 上「給 Issues / PR 分類」的標籤。我們用幾組正交的標籤：
#   - priority:  P0 / P1 / P2 — 講義 Backlog 排序的「Order」
#   - type:      story / bug / nfr / tech / spike — 講義 P.47 backlog item types
#   - segment:   U1 / U2 / U3 / U4 — 我們的 4 個使用者族群
#   - area:      frontend / backend / db / devops — 哪一層的改動
#   - phase:     3 / 4 / 5 / 6 / 7 / 8 — 對應 8-phase roadmap
#   - sprint:    1 / 2 / ... — 規劃中的 sprint
#
# 用法：
#   pwsh ./scripts/setup-labels.ps1
#
# 跑完後可在 https://github.com/48124812/dental-clinic/labels 看到所有 label。
# =============================================================================

$repo = "48124812/dental-clinic"

# 結構：name, color (hex 無 #), description
$labels = @(
    # ----- Priority -----
    @{ name = "priority:P0"; color = "d73a4a"; description = "Must-have for current milestone" }
    @{ name = "priority:P1"; color = "fb8c00"; description = "Important, do after P0" }
    @{ name = "priority:P2"; color = "fbca04"; description = "Nice to have, can defer" }

    # ----- Type -----
    @{ name = "type:story";  color = "0e8a16"; description = "User-facing feature (Agile User Story)" }
    @{ name = "type:bug";    color = "b60205"; description = "Defect — system behavior diverges from expected" }
    @{ name = "type:nfr";    color = "5319e7"; description = "Non-functional requirement (perf, security, a11y...)" }
    @{ name = "type:tech";   color = "8b949e"; description = "Tech work — refactor, deps, infra (no user-visible change)" }
    @{ name = "type:spike";  color = "c2e0c6"; description = "Time-boxed investigation to reduce uncertainty" }

    # ----- User Segment -----
    @{ name = "segment:U1";  color = "f9d0c4"; description = "U1 — 急性疼痛患者 Acute pain patient" }
    @{ name = "segment:U2";  color = "c5def5"; description = "U2 — 家庭主要照顧者 Family caregiver" }
    @{ name = "segment:U3";  color = "fef2c0"; description = "U3 — 美學需求顧客 Aesthetic client" }
    @{ name = "segment:U4";  color = "d4c5f9"; description = "U4 — 診所員工 / 管理員 Staff / Admin" }

    # ----- Area -----
    @{ name = "area:frontend"; color = "1d76db"; description = "Next.js / React / UI" }
    @{ name = "area:backend";  color = "0052cc"; description = "Fastify API / business logic" }
    @{ name = "area:db";       color = "006b75"; description = "PostgreSQL / Prisma migrations" }
    @{ name = "area:devops";   color = "0e8a16"; description = "Docker / K8s / CI/CD / monitoring" }
    @{ name = "area:docs";     color = "ededed"; description = "Documentation only" }

    # ----- Phase -----
    @{ name = "phase:3-mvp";        color = "bfdadc"; description = "Phase 3 — MVP build" }
    @{ name = "phase:4-12factor";   color = "bfdadc"; description = "Phase 4 — 12-Factor refactor" }
    @{ name = "phase:5-container";  color = "bfdadc"; description = "Phase 5 — Containerize" }
    @{ name = "phase:6-cicd";       color = "bfdadc"; description = "Phase 6 — CI/CD" }
    @{ name = "phase:7-deploy";     color = "bfdadc"; description = "Phase 7 — Deploy to cloud" }
    @{ name = "phase:8-observe";    color = "bfdadc"; description = "Phase 8 — Observability" }

    # ----- Sprint -----
    @{ name = "sprint:1"; color = "e99695"; description = "Planned for Sprint 1" }
    @{ name = "sprint:2"; color = "e99695"; description = "Planned for Sprint 2" }
)

Write-Host "Creating $($labels.Count) labels on $repo..." -ForegroundColor Cyan

foreach ($l in $labels) {
    # gh label create 會在 label 已存在時失敗；我們用 --force 強制更新。
    $result = gh label create $l.name `
        --repo $repo `
        --color $l.color `
        --description $l.description `
        --force 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  + $($l.name)" -ForegroundColor Green
    } else {
        Write-Host "  ! $($l.name) — $result" -ForegroundColor Yellow
    }
}

Write-Host "`nDone. Verify at: https://github.com/$repo/labels" -ForegroundColor Cyan
