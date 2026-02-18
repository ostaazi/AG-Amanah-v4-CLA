$src = 'd:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai\android'
$dst = 'd:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai\android-child'

# Create destination
New-Item -ItemType Directory -Path $dst -Force | Out-Null

# Directories and files to exclude
$exclude = @('.gradle','.gradle_user_home','.gradle_user_home2','.gradle_user_home3','.gradle_user_home4','build','.idea','.kotlin','java_pid1640.hprof')

# Copy non-excluded items
Get-ChildItem $src | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
    Copy-Item $_.FullName $dst -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Copy complete!"
Write-Host "Contents of android-child:"
Get-ChildItem $dst | Select-Object Name
