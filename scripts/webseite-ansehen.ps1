# Webseite aus dem Download der Pipeline (probe-webseite) lokal ansehen, ohne Node und ohne Installation.
# Start per Doppelklick auf "Webseite ansehen.cmd" im selben Ordner. Liefert den Ordner unter http://localhost:4000/ aus
# (nur dieser Rechner) und öffnet den Browser. Beenden: Fenster schließen.
# Ein Server ist nötig, weil die Seiten echte Folien in Iframes laden; per Doppelklick auf index.html geht das nicht.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 4000
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.json' = 'application/json'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'
  '.webp' = 'image/webp'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'; '.ttf' = 'font/ttf'; '.ico' = 'image/x-icon'
  '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Hashmark-Webseite: http://localhost:$port/  (zum Beenden das Fenster schliessen)"
Start-Process "http://localhost:$port/"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
    if (-not $file.StartsWith($root) -or -not (Test-Path $file -PathType Leaf)) {
      $res.StatusCode = 404
    } else {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}
