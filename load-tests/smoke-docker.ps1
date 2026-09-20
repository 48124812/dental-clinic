param([string]$ApiImage = 'dental-clinic-api:latest')

# Run from the repo root after docker compose build api web.
# No host ports, .env files, existing volumes, or remote database connections.
$ErrorActionPreference = 'Stop'
$runId = 'dental-k6-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$networkName = $runId
$dbName = "$runId-db"
$apiName = "$runId-api"
$loadName = "$runId-load"
$createdContainers = [System.Collections.Generic.List[string]]::new()
$networkCreated = $false
$scriptPath = (Resolve-Path 'load-tests').Path
$resultsDir = Join-Path $scriptPath "results/$runId"
New-Item -ItemType Directory -Force $resultsDir | Out-Null

function Invoke-Docker {
    & docker @args
    if ($LASTEXITCODE -ne 0) { throw "Docker operation failed: $($args[0])" }
}

try {
    $imageId = Invoke-Docker image inspect $ApiImage '--format={{.Id}}'
    Invoke-Docker network create --internal --label "dental.load-test=$runId" $networkName | Out-Null
    $networkCreated = $true
    Invoke-Docker run -d --name $dbName --network $networkName --network-alias db `
        --label "dental.load-test=$runId" --tmpfs /var/lib/postgresql/data `
        -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=dental_load postgres:16-alpine | Out-Null
    $createdContainers.Add($dbName)
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { docker exec $dbName pg_isready -U postgres -d dental_load *> $null } catch { }
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Isolated database did not become ready' }
    Invoke-Docker run -d --name $apiName --network $networkName `
        --network-alias api.dental-clinic.svc.cluster.local --label "dental.load-test=$runId" `
        -e DATABASE_URL=postgresql://postgres@db:5432/dental_load `
        -e RUN_MIGRATIONS=true -e RUN_SAMPLE_SEED=true -e LOG_LEVEL=error $ApiImage | Out-Null
    $createdContainers.Add($apiName)
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $running = Invoke-Docker inspect $apiName '--format={{.State.Running}}'
        if ($running -ne 'true') { throw 'Isolated API container exited before readiness' }
        try { docker exec $apiName node -e "fetch('http://localhost:3001/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" *> $null } catch { }
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Isolated API did not become ready; no load was sent' }

    $started = [DateTime]::UtcNow.ToString('o')
    # Track the unique test container name even if the run exits on a failed threshold.
    $createdContainers.Add($loadName)
    docker run --name $loadName --network $networkName --label "dental.load-test=$runId" `
        --mount "type=bind,source=$scriptPath,target=/scripts,readonly" `
        --mount "type=bind,source=$resultsDir,target=/results" `
        -e BASE_URL=http://api.dental-clinic.svc.cluster.local:3001 -e PROFILE=smoke `
        grafana/k6:1.0.0 run --summary-export=/results/summary.json /scripts/read-only.js |
        Tee-Object -FilePath (Join-Path $resultsDir 'k6.log')
    $loadExitCode = $LASTEXITCODE
    @{
        runId = $runId; startedUtc = $started; finishedUtc = [DateTime]::UtcNow.ToString('o')
        apiImageId = "$imageId"; profile = 'smoke'; vus = 1; duration = '15s'
        exitCode = $loadExitCode; database = 'disposable tmpfs; demo seed only'
        hpaVerified = $false
    } | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $resultsDir 'metadata.json')
    Write-Output "Evidence: $resultsDir"
    if ($loadExitCode -ne 0) { throw "k6 smoke failed with exit code $loadExitCode" }
}
catch {
    # This stack contains only synthetic seed data and a passwordless local DB.
    # Save startup diagnostics before cleanup; never collect an existing stack.
    if ($createdContainers.Contains($apiName)) {
        $ErrorActionPreference = 'Continue'
        docker logs $apiName > (Join-Path $resultsDir 'api-startup.log') 2>&1
        $ErrorActionPreference = 'Stop'
    }
    Write-Output "Failed-run evidence: $resultsDir"
    throw
}
finally {
    # Only unique resources created by this invocation; never touch existing stacks.
    foreach ($containerName in $createdContainers) {
        docker rm --force $containerName | Out-Null
    }
    if ($networkCreated) { docker network rm $networkName | Out-Null }
}
