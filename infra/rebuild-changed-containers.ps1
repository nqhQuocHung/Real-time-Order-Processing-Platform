[CmdletBinding()]
param(
    [string]$ComposeFile = "docker-compose.yml",
    [string]$Ref = "",
    [switch]$IncludeUntracked = $true,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $result = & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Args -join ' ')"
    }
    return $result
}

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    Write-Host "[docker] docker $($Args -join ' ')" -ForegroundColor Cyan
    if (-not $DryRun) {
        & docker @Args
        if ($LASTEXITCODE -ne 0) {
            throw "Docker command failed: docker $($Args -join ' ')"
        }
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$composePath = Resolve-Path (Join-Path $scriptDir $ComposeFile)

$allAppServices = @(
    "auth-service",
    "inventory-service",
    "payment-service",
    "notification-service",
    "order-service",
    "api-gateway"
)

$serviceByPrefix = @{
    "services/auth-service/" = "auth-service"
    "services/inventory-service/" = "inventory-service"
    "services/payment-service/" = "payment-service"
    "services/notification-service/" = "notification-service"
    "services/order-service/" = "order-service"
    "services/api-gateway/" = "api-gateway"
}

Write-Host "Repository root: $repoRoot" -ForegroundColor Gray
Write-Host "Compose file: $composePath" -ForegroundColor Gray

$changedFiles = @()

if ([string]::IsNullOrWhiteSpace($Ref)) {
    $changedFiles += Invoke-Git -Args @("-C", "$repoRoot", "diff", "--name-only", "HEAD")
    Write-Host "Detecting changes from working tree vs HEAD..." -ForegroundColor Gray
}
else {
    $changedFiles += Invoke-Git -Args @("-C", "$repoRoot", "diff", "--name-only", "$Ref..HEAD")
    Write-Host "Detecting changes from range $Ref..HEAD..." -ForegroundColor Gray
}

if ($IncludeUntracked) {
    $changedFiles += Invoke-Git -Args @("-C", "$repoRoot", "ls-files", "--others", "--exclude-standard")
}

$changedFiles = @(
    $changedFiles |
    Where-Object { $_ -and $_.Trim().Length -gt 0 } |
    ForEach-Object { $_.Trim().Replace("\", "/") } |
    Sort-Object -Unique
)

if ($changedFiles.Count -eq 0) {
    Write-Host "No changes detected. Nothing to rebuild." -ForegroundColor Yellow
    exit 0
}

Write-Host "Changed files:" -ForegroundColor Green
$changedFiles | ForEach-Object { Write-Host " - $_" }

$targetServices = New-Object System.Collections.Generic.HashSet[string]
$forceAllAppServices = $false

foreach ($file in $changedFiles) {
    if ($file -eq "infra/docker-compose.yml") {
        $forceAllAppServices = $true
        continue
    }

    foreach ($prefix in $serviceByPrefix.Keys) {
        if ($file.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            [void]$targetServices.Add($serviceByPrefix[$prefix])
        }
    }

    if ($file.StartsWith("services/", [System.StringComparison]::OrdinalIgnoreCase)) {
        $isKnownService = $false
        foreach ($prefix in $serviceByPrefix.Keys) {
            if ($file.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                $isKnownService = $true
                break
            }
        }

        if (-not $isKnownService) {
            $forceAllAppServices = $true
        }
    }
}

if ($forceAllAppServices) {
    foreach ($service in $allAppServices) {
        [void]$targetServices.Add($service)
    }
}

$services = @($targetServices | Sort-Object)

if ($services.Count -eq 0) {
    Write-Host "No containerized service impacted by changed files." -ForegroundColor Yellow
    exit 0
}

Write-Host "Services to rebuild/restart: $($services -join ', ')" -ForegroundColor Green

$composeArgs = @("compose", "-f", "$composePath")

Invoke-Docker -Args ($composeArgs + @("build") + $services)
Invoke-Docker -Args ($composeArgs + @("up", "-d", "--no-deps") + $services)

if ($DryRun) {
    Write-Host "Dry run completed. No Docker command executed." -ForegroundColor Yellow
}
else {
    Write-Host "Rebuild and restart completed successfully." -ForegroundColor Green
}
