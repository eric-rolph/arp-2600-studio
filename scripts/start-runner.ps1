$ErrorActionPreference = 'Stop'
$runnerDir = Join-Path $env:LOCALAPPDATA 'CodexPrivate\GitHubRunner\arp-2600-studio'
$listener = Join-Path $runnerDir 'bin\Runner.Listener.exe'
if (-not (Test-Path -LiteralPath $listener)) { throw 'The repository runner is not installed for this Windows user.' }
$running = Get-CimInstance Win32_Process -Filter "Name = 'Runner.Listener.exe'" | Where-Object ExecutablePath -eq $listener
if ($running) { Write-Output 'The 2600 Studio runner is already running.'; exit 0 }
Start-Process -FilePath $env:ComSpec -ArgumentList '/c', 'run.cmd' -WorkingDirectory $runnerDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runnerDir 'runner-output.log') -RedirectStandardError (Join-Path $runnerDir 'runner-error.log')
Write-Output 'Started the 2600 Studio GitHub runner in the background.'
