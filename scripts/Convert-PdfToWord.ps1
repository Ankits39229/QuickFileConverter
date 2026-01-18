# PDF to Word Converter CLI
# Usage: .\scripts\Convert-PdfToWord.ps1 -InputFile <path> [-OutputFile <path>]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$false, Position=1)]
    [string]$OutputFile
)

# Validate input file exists
if (-not (Test-Path $InputFile)) {
    Write-Error "Input file not found: $InputFile"
    exit 1
}

# Resolve full paths
$InputFile = Resolve-Path $InputFile

# Set output file if not specified
if ([string]::IsNullOrEmpty($OutputFile)) {
    $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, ".docx")
} else {
    $OutputFile = Join-Path (Get-Location) $OutputFile
}

Write-Host "Converting PDF to Word..." -ForegroundColor Cyan
Write-Host "Input:  $InputFile" -ForegroundColor Gray
Write-Host "Output: $OutputFile" -ForegroundColor Gray
Write-Host ""

# Run the Node.js conversion script
$scriptPath = Join-Path $PSScriptRoot "pdf-to-word.mjs"
node $scriptPath $InputFile $OutputFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Success! Open the file with:" -ForegroundColor Green
    Write-Host "  start `"$OutputFile`"" -ForegroundColor Yellow
}
