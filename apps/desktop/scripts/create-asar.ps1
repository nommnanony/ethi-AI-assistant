$DesktopPath = "C:\Users\karti_l9jsm6w\Natively-AI-assistant\apps\desktop"
$AsarDir = "$env:TEMP\natively-asar"
$AsarTool = "C:\Users\karti_l9jsm6w\Natively-AI-assistant\node_modules\.pnpm\node_modules\.bin\asar.cmd"

# Clean and create temp dir
if (Test-Path $AsarDir) { Remove-Item $AsarDir -Recurse -Force }
New-Item -ItemType Directory -Path "$AsarDir\dist" -Force | Out-Null
New-Item -ItemType Directory -Path "$AsarDir\electron-dist" -Force | Out-Null

# Copy built files
Copy-Item "$DesktopPath\dist\*" "$AsarDir\dist\" -Recurse -Force
Copy-Item "$DesktopPath\electron-dist\*" "$AsarDir\electron-dist\" -Recurse -Force

# Create package.json
$pkg = '{"name":"natively-ai","version":"1.0.0","main":"electron-dist/main.mjs"}'
Set-Content -Path "$AsarDir\package.json" -Value $pkg -Encoding UTF8 -NoNewline

# Pack asar
& $AsarTool pack $AsarDir "$DesktopPath\release\Natively AI\resources\app.asar" 2>&1

$asarPath = "$DesktopPath\release\Natively AI\resources\app.asar"
if (Test-Path $asarPath) {
  $size = [math]::Round((Get-Item $asarPath).Length / 1MB, 1)
  Write-Output "app.asar created: $size MB"
} else {
  Write-Output "ERROR: app.asar not created"
}

# Cleanup
Remove-Item $AsarDir -Recurse -Force -ErrorAction SilentlyContinue
