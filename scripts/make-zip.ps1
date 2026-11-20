$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$zipOutput = Join-Path $projectRoot "JMCFI-PostFlow-Migration-Ready.zip"
$stageDir = Join-Path $env:TEMP "jmcfi_migration_stage"

if (Test-Path $zipOutput) {
    Remove-Item $zipOutput -Force
}
if (Test-Path $stageDir) {
    Remove-Item $stageDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

Write-Host "Copying project files (excluding node_modules, vendor, .git, .expo, etc.)..."

$excludeDirs = @('node_modules', 'vendor', '.git', '.expo', '.ui-ux-backups', 'transfer', 'logs', 'cache', '.scannerwork')
$excludeFiles = @('*.zip', '*.log', '*.tmp')

# Robocopy exit codes 0-7 are success
$null = robocopy $projectRoot $stageDir /E /XD $excludeDirs /XF $excludeFiles /NFL /NDL /NJH /NJS

Write-Host "Creating zip archive: $zipOutput..."
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stageDir, $zipOutput, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Remove-Item $stageDir -Recurse -Force

$zipItem = Get-Item $zipOutput
$sizeMb = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "Success! Created $zipOutput ($sizeMb MB)"
