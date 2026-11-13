# SimLab 3D as a desktop app (Windows): the production build in its own Microsoft Edge window.
#
#   powershell -ExecutionPolicy Bypass -File scripts\desktop-app.ps1 -Install   # Desktop shortcut
#   powershell -ExecutionPolicy Bypass -File scripts\desktop-app.ps1            # what it runs
#
# Builds into dist-app\ when the sources are newer than it (vite only, no typecheck: a test build),
# serves it on port 5190 and opens Edge in app mode with its own profile (saves and settings
# apart from the dev server's); closing the window stops the server. Not dist\ nor the e2e ports
# (5197-5199), not 5173.
param([switch]$Install)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$name = 'SimLab 3D'
$port = 5190
$url = "http://localhost:$port"
$data = Join-Path $env:LOCALAPPDATA 'SimLab3D'
$out = Join-Path $root 'dist-app'
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found.' }
New-Item -ItemType Directory -Force $data | Out-Null

if ($Install) {
  # The icon: a 256 px PNG in an .ico (Windows reads PNG entries since Vista).
  Add-Type -AssemblyName System.Drawing
  $bmp = New-Object System.Drawing.Bitmap 256, 256
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 22, 44, 66))
  $g.FillEllipse($bg, 8, 8, 240, 240)
  $font = New-Object System.Drawing.Font 'Segoe UI', 92, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $g.DrawString('3D', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 4, 256, 256), $fmt)
  $g.Dispose()
  $png = New-Object System.IO.MemoryStream
  $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $png.ToArray()
  $ico = Join-Path $data 'simlab.ico'
  $w = New-Object System.IO.BinaryWriter ([System.IO.File]::Create($ico))
  $w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)          # header: icon, 1 image
  $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0) # 256×256, no palette
  $w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$bytes.Length); $w.Write([UInt32]22)
  $w.Write($bytes); $w.Close()

  $lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
  $s.WorkingDirectory = $root
  $s.IconLocation = $ico
  $s.Description = $name
  $s.Save()
  Write-Output "Shortcut: $lnk"
  return
}

function Listening { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }

$server = $null
if (-not (Listening)) {
  # Rebuilt when anything it is built from changed since the last build.
  $built = Join-Path $out 'index.html'
  $since = if (Test-Path $built) { (Get-Item $built).LastWriteTime } else { [datetime]::MinValue }
  $sources = @('src', 'public') | ForEach-Object { Get-ChildItem (Join-Path $root $_) -Recurse -File }
  $sources += @('index.html', 'package.json', 'vite.config.ts') | ForEach-Object { Get-Item (Join-Path $root $_) }
  if ($sources | Where-Object { $_.LastWriteTime -gt $since } | Select-Object -First 1) {
    # In a window of its own, so the wait (~1 min) is visible; a failed build keeps it open.
    $build = Start-Process cmd -WorkingDirectory $root -PassThru -Wait -ArgumentList '/c',
    "title $name - building & npx vite build --outDir dist-app --emptyOutDir || (echo. & echo Build failed. & pause & exit /b 1)"
    if ($build.ExitCode -ne 0) { exit 1 }
  }
  $server = Start-Process node -WorkingDirectory $root -WindowStyle Hidden -PassThru -ArgumentList `
    'node_modules/vite/bin/vite.js', 'preview', '--outDir', 'dist-app', '--port', $port, '--strictPort', '--host'
  for ($i = 0; $i -lt 100 -and -not (Listening); $i++) { Start-Sleep -Milliseconds 200 }
  if (-not (Listening)) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue; throw "Server did not start on $port." }
}

# Its own profile: the browser process is this one, so -Wait lasts as long as the window.
$app = Start-Process $edge -PassThru -Wait -ArgumentList "--app=$url", "--user-data-dir=`"$data\edge`"",
'--no-first-run', '--no-default-browser-check', '--start-maximized'
# The window that started the server stops it (another window, already served, leaves it).
if ($server) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
