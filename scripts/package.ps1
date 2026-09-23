$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$parentRoot = Split-Path $projectRoot -Parent
$stageRoot = Join-Path $parentRoot ('readiness-package-' + [Guid]::NewGuid().ToString('N'))
$stageProject = Join-Path $stageRoot 'student-readiness-control-center'
$archivePath = Join-Path $parentRoot 'student-readiness-control-center.zip'
New-Item -ItemType Directory -Path $stageProject -Force | Out-Null
Push-Location $projectRoot
try {
  $tracked = git ls-files
  if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate tracked source files.' }
  foreach ($relative in $tracked) {
    if ($relative -match '(^|/)\.env($|\.)' -and $relative -notmatch '\.env\.example$') { throw 'Refusing to package environment credentials.' }
    $source = Join-Path $projectRoot $relative
    $destination = Join-Path $stageProject $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
  }
  Copy-Item -LiteralPath (Join-Path $projectRoot '.git') -Destination (Join-Path $stageProject '.git') -Recurse -Force
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
  [IO.Compression.ZipFile]::CreateFromDirectory($stageRoot, $archivePath, [IO.Compression.CompressionLevel]::Optimal, $false)
  Write-Output "Packaged source and Git history: $archivePath"
  Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
} finally {
  Pop-Location
  # Check the absolute deletion target before recursively removing staging files.
  $resolvedStage = [IO.Path]::GetFullPath($stageRoot)
  if ($resolvedStage.StartsWith($parentRoot + [IO.Path]::DirectorySeparatorChar) -and (Split-Path $resolvedStage -Leaf).StartsWith('readiness-package-')) {
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
  }
}
