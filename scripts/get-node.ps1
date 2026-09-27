# Lädt eine portable Node.js-Version nach vendor/node (ohne Installation, ohne Admin-Rechte)
# und prüft die SHA256-Prüfsumme gegen die offizielle SHASUMS256.txt.
param(
  [string]$Version = "24.21.0",
  [string]$Dest = "vendor\node"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$name = "node-v$Version-win-x64"
$base = "https://nodejs.org/dist/v$Version"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "strata-node-$Version"
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp "$name.zip"

Write-Host "Lade Node.js $Version ..."
Invoke-WebRequest "$base/$name.zip" -OutFile $zip
$expected = ((Invoke-WebRequest "$base/SHASUMS256.txt").Content -split "`n" | Where-Object { $_ -match " $name\.zip$" }) -replace "\s.*$", ""
$actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if (-not $expected -or $actual -ne $expected.Trim()) { throw "Prüfsumme stimmt nicht ($actual vs. $expected)" }
Write-Host "Prüfsumme OK."

Expand-Archive $zip -DestinationPath $tmp -Force
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
New-Item -ItemType Directory -Force (Split-Path $Dest) | Out-Null
Move-Item (Join-Path $tmp $name) $Dest
Remove-Item -Recurse -Force $tmp
Write-Host "Node.js liegt in $Dest"
