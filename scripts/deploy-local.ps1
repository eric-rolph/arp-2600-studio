$ErrorActionPreference = 'Stop'
$credentialPath = Join-Path $env:LOCALAPPDATA 'CodexPrivate\Cloudflare\cold-hill-01a7.credentials.xml'
if (-not (Test-Path -LiteralPath $credentialPath)) {
    throw 'The encrypted local Cloudflare credential store was not found for this Windows user.'
}
$saved = Import-Clixml -LiteralPath $credentialPath
$env:CLOUDFLARE_API_TOKEN = ([pscredential]::new('token', $saved.ApiToken)).GetNetworkCredential().Password
$env:CLOUDFLARE_ACCOUNT_ID = $saved.AccountId
$env:WRANGLER_SEND_METRICS = 'false'
try {
    # GitHub masking is registered without printing the value as normal log output.
    if ($env:GITHUB_ACTIONS -eq 'true') { Write-Output ('::add-mask::' + $env:CLOUDFLARE_API_TOKEN) }
    npm.cmd run deploy
    if ($LASTEXITCODE -ne 0) { throw 'Cloudflare deployment failed.' }
} finally {
    Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:CLOUDFLARE_ACCOUNT_ID -ErrorAction SilentlyContinue
    $saved = $null
}
