# Test if Microsoft Office is installed and accessible

Write-Output "Testing Microsoft Word availability..."

try {
    $word = New-Object -ComObject Word.Application
    $version = $word.Version
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    
    Write-Output "SUCCESS: Microsoft Word is installed"
    Write-Output "Version: $version"
    exit 0
}
catch {
    Write-Output "FAILED: Microsoft Word is not installed or cannot be accessed"
    Write-Output "Error: $($_.Exception.Message)"
    Write-Output ""
    Write-Output "Please install Microsoft Office to use this feature."
    exit 1
}
