# Starts everything needed to play Touchdown PVP locally:
#   1. Docker Desktop (if it isn't running) and the game database
#   2. The game server  (server/  npm run dev)    -> its own terminal tab
#   3. The Expo app     (client/  npx expo start) -> its own terminal tab
# Run it by double-clicking start-game.bat, or: powershell -File start-game.ps1
# Stop: Ctrl+C in each tab; the database keeps running until `docker compose stop`.
# -DryRun checks everything and prints what it would open, without opening it.

param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$serverDir = Join-Path $root 'server'
$clientDir = Join-Path $root 'client'
$gamePort = 3100 # matches PORT in server/src/index.ts
$expoPort = 8081 # Metro's default

# Windows PowerShell treats a native command's error output as a failure when
# $ErrorActionPreference is Stop, so Docker's "not running" message would end
# the script. Run it with Continue and look at the exit code instead.
function Test-Docker {
    $ErrorActionPreference = 'Continue'
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Test-Listening($port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Write-Step($text) { Write-Host "`n> $text" -ForegroundColor Cyan }
function Fail($text) {
    Write-Host "`n$text" -ForegroundColor Red
    exit 1
}

# --- 1. Docker + database --------------------------------------------------
Write-Step 'Checking Docker'
if (-not (Test-Docker)) {
    $dockerDesktop = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
    if (-not (Test-Path $dockerDesktop)) { $dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe' }
    if (-not (Test-Path $dockerDesktop)) { Fail 'Docker Desktop is not installed (needed for the database).' }

    Write-Host '  Starting Docker Desktop (this can take a minute)...'
    Start-Process $dockerDesktop
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 3
        if (Test-Docker) { $ready = $true; break }
    }
    if (-not $ready) { Fail 'Docker Desktop did not start within 3 minutes. Start it by hand, then run this again.' }
}
Write-Host '  Docker is running.'

Write-Step 'Starting the database'
Push-Location $root
$ErrorActionPreference = 'Continue' # docker compose reports progress on its error output
docker compose up -d --wait
$dbExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
Pop-Location
if ($dbExit -ne 0) { Fail 'The database container did not start. See the Docker messages above.' }

# --- 2. Dependencies -------------------------------------------------------
foreach ($dir in $serverDir, $clientDir) {
    if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
        Write-Step "Installing packages in $(Split-Path $dir -Leaf)/ (first run only)"
        Push-Location $dir
        $ErrorActionPreference = 'Continue'
        npm install
        $installExit = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        Pop-Location
        if ($installExit -ne 0) { Fail "npm install failed in $dir" }
    }
}

# --- 3. Is the game port free? ---------------------------------------------
$startServer = $true
$listener = Get-NetTCPConnection -LocalPort $gamePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $isGame = $false
    try {
        $health = Invoke-RestMethod "http://localhost:$gamePort/health" -TimeoutSec 3
        $isGame = $health.ok -eq $true -and $null -ne $health.activeMatches
    } catch { }
    if ($isGame) {
        Write-Host "`n  The game server is already running on port $gamePort; not starting another." -ForegroundColor Yellow
        $startServer = $false
    } else {
        $name = (Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue).ProcessName
        Fail "Port $gamePort is used by another program ($name). Close it, or change PORT in server/src/index.ts and SERVER_PORT in client/src/services/SocketService.ts."
    }
}

# The adapter with a default gateway is the real network (not WSL, VMware or other virtual adapters)
$ip = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    Select-Object -First 1 -ExpandProperty IPv4Address |
    Select-Object -First 1 -ExpandProperty IPAddress

# --- 4. Open the terminals -------------------------------------------------
Write-Step 'Opening the game server and Expo app'
$tabs = @()
if ($startServer) { $tabs += @{ Title = 'Game server'; Dir = $serverDir; Command = 'npm run dev' } }
if (Test-Listening $expoPort) {
    Write-Host "`n  The Expo app is already running (port $expoPort); not starting another." -ForegroundColor Yellow
} else {
    if ($ip) { $env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip }
    $tabs += @{ Title = 'Expo app'; Dir = $clientDir; Command = 'npx expo start' }
}

if ($tabs.Count -eq 0) {
    Write-Host "`nEverything is already running." -ForegroundColor Green
    exit 0
}
if ($DryRun) {
    foreach ($t in $tabs) { Write-Host "  [dry run] would open '$($t.Title)': $($t.Command)  (in $($t.Dir))" }
    exit 0
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if ($wt) {
    # One Windows Terminal window, one tab each
    $parts = foreach ($t in $tabs) {
        "new-tab --title `"$($t.Title)`" -d `"$($t.Dir)`" powershell -NoExit -Command $($t.Command)"
    }
    Start-Process $wt.Source -ArgumentList ('-w new ' + ($parts -join ' ; '))
} else {
    # No Windows Terminal: a separate PowerShell window each
    foreach ($t in $tabs) {
        Start-Process powershell -WorkingDirectory $t.Dir -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = '$($t.Title)'; $($t.Command)"
    }
}

Write-Host "`nAll started." -ForegroundColor Green
Write-Host '  - Scan the QR code in the "Expo app" tab with Expo Go.'
if ($ip) { Write-Host "  - Phones must be on the same Wi-Fi as this PC ($ip)." }
Write-Host '  - Stop: Ctrl+C in each tab. Stop the database: docker compose stop'
