# Git smart-HTTP transport using the platform TLS stack. No certificate bypass,
# filesystem deletion, credential file or force update is used.
$ErrorActionPreference = 'Stop'
$requestInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$credential = $requestInput.credential
$repositoryRoot = (Get-Location).Path
$remoteUri = [Uri]$credential.remote_url
if ($remoteUri.Scheme -ne 'https' -or $remoteUri.UserInfo -or $remoteUri.Query -or $remoteUri.Fragment) { throw 'Invalid repository destination.' }
if ($credential.auth_mode -ne 'http_extra_header') { throw 'This fallback requires returned bearer repository access.' }
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [System.Net.Http.HttpClient]::new($handler)
$client.Timeout = [TimeSpan]::FromSeconds(35)
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $credential.token)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('git/2.50.0')
$remoteBase = $credential.remote_url.TrimEnd('/')
$refName = 'refs/heads/' + $credential.branch

function Get-RemoteHead {
    $response = $client.GetAsync($remoteBase + '/info/refs?service=git-receive-pack').GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw ('Repository discovery HTTP ' + [int]$response.StatusCode) }
    $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $advert = [Text.Encoding]::UTF8.GetString($bytes)
    $match = [regex]::Match($advert, '([a-f0-9]{40}) ' + [regex]::Escape($refName) + '(?:\x00|\n)')
    if ($match.Success) { return $match.Groups[1].Value }
    if (-not $advert.Contains('# service=git-receive-pack')) { throw 'Unexpected Git service response.' }
    return ('0' * 40)
}

try {
    $oldHead = Get-RemoteHead
    $newHead = [string]$requestInput.commit_sha
    if ($oldHead -eq $newHead) {
        @{ project_id=$requestInput.project_id;commit_sha=$newHead;already_current=$true } | ConvertTo-Json -Compress
        exit 0
    }
    if ($oldHead -ne ('0' * 40)) {
        & git -c ('safe.directory=' + $repositoryRoot.Replace('\','/')) merge-base --is-ancestor $oldHead $newHead 2>$null
        if ($LASTEXITCODE -ne 0) { throw 'Remote source advanced or is not locally known. Preserve and reconcile before pushing.' }
    }
    $command = $oldHead + ' ' + $newHead + ' ' + $refName + [char]0 + 'report-status' + [char]10
    $commandBytes = [Text.Encoding]::ASCII.GetBytes($command)
    $prefix = [Text.Encoding]::ASCII.GetBytes(('{0:x4}' -f ($commandBytes.Length + 4)))
    $flush = [Text.Encoding]::ASCII.GetBytes('0000')
    $pack = [IO.File]::ReadAllBytes([string]$requestInput.pack_path)
    $stream = [IO.MemoryStream]::new()
    $stream.Write($prefix);$stream.Write($commandBytes);$stream.Write($flush);$stream.Write($pack)
    $content = [System.Net.Http.ByteArrayContent]::new($stream.ToArray())
    $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/x-git-receive-pack-request')
    $response = $client.PostAsync($remoteBase + '/git-receive-pack', $content).GetAwaiter().GetResult()
    if (-not $response.IsSuccessStatusCode) { throw ('Repository push HTTP ' + [int]$response.StatusCode) }
    $report = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (-not $report.Contains('unpack ok') -or -not $report.Contains('ok ' + $refName)) { throw 'Git service did not confirm the source update.' }
    if ((Get-RemoteHead) -ne $newHead) { throw 'Remote commit verification failed.' }
    @{ project_id=$requestInput.project_id;commit_sha=$newHead;verified=$true } | ConvertTo-Json -Compress
} finally {
    $client.Dispose();$handler.Dispose()
}
