$ErrorActionPreference = 'Stop'

$frontendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$standaloneRoot = Join-Path $frontendRoot '.next\standalone'
$staticSource = Join-Path $frontendRoot '.next\static'
$staticTarget = Join-Path $standaloneRoot '.next\static'

if (-not (Test-Path (Join-Path $standaloneRoot 'server.js'))) {
  throw 'Production build not found. Run npm run build from the frontend folder first.'
}
if (-not (Test-Path $staticSource)) {
  throw 'Next.js static assets are missing. Run npm run build from the frontend folder first.'
}

New-Item -ItemType Directory -Path $staticTarget -Force | Out-Null
Copy-Item -Path (Join-Path $staticSource '*') -Destination $staticTarget -Recurse -Force
$publicSource = Join-Path $frontendRoot 'public'
if (Test-Path $publicSource) {
  Copy-Item -Path $publicSource -Destination $standaloneRoot -Recurse -Force
}

$env:HOSTNAME = '127.0.0.1'
$env:PORT = '3000'
Push-Location $standaloneRoot
try {
  node .\server.js
} finally {
  Pop-Location
}
