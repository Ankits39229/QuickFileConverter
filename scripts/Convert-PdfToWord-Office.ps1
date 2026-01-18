# PDF to Word Converter using Microsoft Office COM
# Professional quality conversion - works offline
# Usage: .\Convert-PdfToWord-Office.ps1 -InputFile <path> -OutputFile <path>

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$true)]
    [string]$OutputFile
)

# Validate input file exists
if (-not (Test-Path $InputFile)) {
    Write-Error "Input file not found: $InputFile"
    exit 1
}

# Resolve full paths
$InputFile = Resolve-Path $InputFile
$OutputFile = [System.IO.Path]::GetFullPath($OutputFile)

# Ensure output directory exists
$outputDir = [System.IO.Path]::GetDirectoryName($OutputFile)
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

try {
    # Create Word Application COM object
    $Word = New-Object -ComObject Word.Application
    $Word.Visible = $false
    $Word.DisplayAlerts = 0  # wdAlertsNone
    
    # Open the PDF file
    # Word can open PDF files directly and convert them
    $Doc = $Word.Documents.Open($InputFile, $false, $true, $false, "", "", $false, "", "", 6)  # Format 6 = PDF
    
    # Save as DOCX (format 16 = wdFormatXMLDocument)
    $Doc.SaveAs([ref]$OutputFile, [ref]16)
    
    # Close document
    $Doc.Close($false)
    
    # Quit Word
    $Word.Quit()
    
    # Release COM objects
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Doc) | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    # Verify output file was created
    if (Test-Path $OutputFile) {
        Write-Output "SUCCESS:$OutputFile"
        exit 0
    } else {
        Write-Error "Failed to create output file"
        exit 1
    }
}
catch {
    Write-Error "Conversion failed: $_"
    
    # Clean up COM objects
    try {
        if ($Doc) { $Doc.Close($false) }
        if ($Word) { $Word.Quit() }
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Doc) | Out-Null
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Word) | Out-Null
    } catch {}
    
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    exit 1
}
