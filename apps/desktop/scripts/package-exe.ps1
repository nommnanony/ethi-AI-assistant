param(
  [string]$DesktopPath = "C:\Users\karti_l9jsm6w\Natively-AI-assistant\apps\desktop"
)

$electronDir = "C:\Users\karti_l9jsm6w\Natively-AI-assistant\node_modules\.pnpm\electron@42.0.1\node_modules\electron\dist"
$release = "$DesktopPath\release\Natively AI"
$asarTmp = "$env:TEMP\natively-asar"

Write-Output "=== Packaging Natively AI ==="

# Create release folders
New-Item -ItemType Directory -Path $release -Force | Out-Null
New-Item -ItemType Directory -Path "$release\resources" -Force | Out-Null

# Copy Electron runtime
Write-Output "Copying Electron runtime..."
Copy-Item "$electronDir\*" -Destination $release -Recurse -Force -Exclude "resources"

# Prepare asar contents
if (Test-Path $asarTmp) { Remove-Item $asarTmp -Recurse -Force }
New-Item -ItemType Directory -Path "$asarTmp\dist" -Force | Out-Null
New-Item -ItemType Directory -Path "$asarTmp\electron-dist" -Force | Out-Null

Copy-Item "$DesktopPath\dist\*" -Destination "$asarTmp\dist" -Recurse -Force
Copy-Item "$DesktopPath\electron-dist\*" -Destination "$asarTmp\electron-dist" -Recurse -Force

# package.json for asar entry point
$pkg = @{
  name = "natively-ai"
  version = "1.0.0"
  main = "electron-dist/main.mjs"
}
$pkg | ConvertTo-Json | Set-Content "$asarTmp\package.json" -Encoding UTF8

# Pack asar
Write-Output "Creating app.asar..."
npx asar pack $asarTmp "$release\resources\app.asar" 2>&1

# Rename electron.exe to product name
Move-Item "$release\electron.exe" "$release\Natively AI.exe" -Force

# Cleanup
Remove-Item $asarTmp -Recurse -Force

$exeSize = [math]::Round((Get-Item "$release\Natively AI.exe").Length / 1MB, 1)
$asarSize = [math]::Round((Get-Item "$release\resources\app.asar").Length / 1MB, 1)

Write-Output "=== DONE ==="
Write-Output "EXE: $release\Natively AI.exe"
Write-Output "Size: $exeSize MB (app.asar: $asarSize MB)"
Write-Output "Run: `"$release\Natively AI.exe`""
