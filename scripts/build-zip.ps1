param(
  [string]$OutputName = "asoview-autofill-extension.zip"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..")
$distDir = Join-Path $rootDir "dist"
$stageDir = Join-Path $distDir "_stage"
$zipPath = Join-Path $distDir $OutputName

$requiredFiles = @(
  "manifest.json",
  "content.js",
  "content.css",
  "options.html",
  "options.js",
  "options.css"
)

if (!(Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

if (Test-Path $stageDir) {
  Remove-Item -Recurse -Force $stageDir
}
New-Item -ItemType Directory -Path $stageDir | Out-Null

foreach ($file in $requiredFiles) {
  $source = Join-Path $rootDir $file
  if (!(Test-Path $source)) {
    throw "Required file is missing: $file"
  }
  Copy-Item -Path $source -Destination (Join-Path $stageDir $file)
}

if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $stageDir

Write-Host "Created: $zipPath"
