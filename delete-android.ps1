$target = '\\?\d:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai\android'

# Use .NET to handle long paths
function Remove-LongPath {
    param([string]$Path)

    if ([System.IO.Directory]::Exists($Path)) {
        $entries = [System.IO.Directory]::GetFileSystemEntries($Path)
        foreach ($entry in $entries) {
            if ([System.IO.File]::GetAttributes($entry) -band [System.IO.FileAttributes]::Directory) {
                Remove-LongPath -Path $entry
            } else {
                try { [System.IO.File]::Delete($entry) } catch { }
            }
        }
        try { [System.IO.Directory]::Delete($Path) } catch { }
    }
}

Write-Host "Deleting android directory with long path support..."
Remove-LongPath -Path $target
Write-Host "Done!"

$normalPath = 'd:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai\android'
if (Test-Path $normalPath) {
    Write-Host "android/ still exists, trying rmdir..."
    cmd /c "rmdir /s /q `"$normalPath`"" 2>$null
}

if (Test-Path $normalPath) {
    Write-Host "STILL EXISTS - remaining items:"
    (Get-ChildItem $normalPath -Force -ErrorAction SilentlyContinue).Count
} else {
    Write-Host "SUCCESS - android/ deleted!"
}
