$ErrorActionPreference = 'Stop'
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installers = @(Get-ChildItem src-tauri/target/release/bundle/nsis/*-setup.exe)
if ($installers.Count -ne 1) { throw 'Expected one NSIS installer' }
$stage = Join-Path $env:RUNNER_TEMP ('timora-package-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $stage | Out-Null
New-Item -ItemType Directory -Path dist-windows -Force | Out-Null
Copy-Item $installers[0].FullName (Join-Path $stage 'Timora-setup.exe')
@'
Timora Windows x64

Run Timora-setup.exe and follow the installer prompts.
The installer bundles the WebView2 runtime for offline installation.
Existing workspace data must be preserved during an upgrade.
Do not delete the application data folder to resolve an update problem.
Back up your workspace in Timora before upgrading.

This CI artifact is a candidate. Installation, upgrade and data preservation
acceptance must pass before it is published as an official release.
SHA-256 verifies file integrity; it is not an Authenticode publisher signature.
'@ | Set-Content -Path (Join-Path $stage 'README.txt') -Encoding utf8
$hash = (Get-FileHash (Join-Path $stage 'Timora-setup.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  Timora-setup.exe" | Set-Content -Path (Join-Path $stage 'checksums.txt') -Encoding ascii
$zip = Join-Path 'dist-windows' "Timora-v$version-Windows-x64.zip"
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
Copy-Item $installers[0].FullName (Join-Path 'dist-windows' "Timora-v$version-Windows-x64.exe")
Get-ChildItem dist-windows/* | ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())  $($_.Name)" } | Set-Content dist-windows/SHA256SUMS.txt -Encoding ascii
