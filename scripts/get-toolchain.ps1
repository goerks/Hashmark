# Werkzeuge für die Desktop-App (Tauri) – ohne Admin-Rechte, nichts davon kommt ins Repo:
#   - Rust über rustup (Benutzerprofil, %USERPROFILE%\.cargo und .rustup), Toolchain stable-x86_64-pc-windows-gnullvm
#   - llvm-mingw (Clang, Linker, windres) nach %LOCALAPPDATA%\hashmark-toolchain, SHA256 geprüft
# Visual Studio bzw. die MSVC Build Tools werden nicht gebraucht.
param(
  [string]$LlvmMingw = "20260922",
  [string]$LlvmMingwSha256 = "e3ad77d117a4bea19a7a3b333341824d79a5a371004a10e25b8504e7b3047666"
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$rustup = Join-Path $cargoBin "rustup.exe"
if (-not (Test-Path $rustup)) {
  Write-Host "Installiere rustup (Benutzer, ohne Admin) ..."
  winget install --id Rustlang.Rustup --exact --source winget --accept-package-agreements --accept-source-agreements
  if (-not (Test-Path $rustup)) { throw "rustup nicht gefunden – bitte https://rustup.rs manuell installieren." }
}
Write-Host "Rust-Toolchain stable-x86_64-pc-windows-gnullvm ..."
& $rustup toolchain install stable-x86_64-pc-windows-gnullvm --profile minimal
if ($LASTEXITCODE -ne 0) { throw "rustup toolchain install fehlgeschlagen" }

$name = "llvm-mingw-$LlvmMingw-ucrt-x86_64"
$root = Join-Path $env:LOCALAPPDATA "hashmark-toolchain"
$bin = Join-Path $root "$name\bin"
if (Test-Path (Join-Path $bin "x86_64-w64-mingw32-clang.exe")) {
  Write-Host "llvm-mingw $LlvmMingw ist bereits installiert."
} else {
  New-Item -ItemType Directory -Force $root | Out-Null
  $zip = Join-Path ([System.IO.Path]::GetTempPath()) "$name.zip"
  Write-Host "Lade llvm-mingw $LlvmMingw (~190 MB) ..."
  Invoke-WebRequest "https://github.com/mstorsjo/llvm-mingw/releases/download/$LlvmMingw/$name.zip" -OutFile $zip
  $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $LlvmMingwSha256) { Remove-Item $zip; throw "Prüfsumme stimmt nicht ($actual)" }
  Write-Host "Prüfsumme OK, entpacke ..."
  Expand-Archive $zip -DestinationPath $root -Force
  Remove-Item $zip
}
Write-Host "Fertig. Compiler: $bin"
