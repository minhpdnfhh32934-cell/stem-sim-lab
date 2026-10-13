<#
.SYNOPSIS
  Connects this machine's Claude Code to the other machine through GitHub labels.

.DESCRIPTION
  The two machines never talk directly (different Claude accounts). This watcher polls GitHub
  for work addressed to this machine's role and runs Claude Code headless on it:

    lead    : issues labelled needs-plan     -> /sl-plan <issue>
              PRs labelled needs-review      -> /sl-review <pr>
    builder : PRs labelled changes-requested -> /sl-implement <linked issue>
              issues labelled approved       -> /sl-implement <issue>
    both    : everything above, so two machines can each run "-Role both" and work in
              parallel: a machine claims an issue (GitHub assignee) when it plans or starts it,
              owns it to the end (plan, code, rework), and only reviews the OTHER account's PRs.
              Order per cycle: review, own rework, plan, implement.
    all     : issues labelled agent-ping     -> comment "pong:<role>" (connection test)

  Human gates stay with the user: adding "approved" to a plan and merging a PR.
  One task per cycle, one watcher per machine (lock file), logs in .agent-logs/.
  Written for Windows PowerShell 5.1 and PowerShell 7.

.EXAMPLE
  .\scripts\agents\watch.ps1 -Role builder
  .\scripts\agents\watch.ps1 -Role lead -Once -DryRun
  .\scripts\agents\watch.ps1 -Role both
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('lead', 'builder', 'both')][string]$Role,
  [int]$IntervalMinutes = 5,
  [switch]$Once,
  [switch]$DryRun,
  [int]$MaxReviewRounds = 3,
  [int]$MaxTurns = 150
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot
$LogDir = Join-Path $RepoRoot '.agent-logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LockFile = Join-Path $LogDir "$Role.lock"

# Labels that take an item out of the automatic loop until the user removes them.
$StopLabels = @('needs-human', 'agent-failed')

# Permissions follow the COMMAND, not the role, so a "both" machine reviews with the read-only
# profile. Planning and reviewing: default mode, file edits outside .agent-logs/ are refused.
# Implementing edits code: acceptEdits.
$Mode = @{ lead = 'default'; builder = 'acceptEdits' }

# Tools allowed for unattended runs, on top of .claude/settings.json (whose deny list still
# applies: no merge, no release, no push to main, no force-push). Branch protection on GitHub is
# the second guard.
$Allowed = @{
  lead    = @('Read', 'Glob', 'Grep', 'Edit(./.agent-logs/**)',
              'Bash(gh issue create:*)', 'Bash(gh issue comment:*)', 'Bash(gh issue edit:*)',
              'Bash(gh pr review:*)', 'Bash(gh pr edit:*)', 'Bash(gh pr comment:*)')
  builder = @('Read', 'Glob', 'Grep', 'Edit', 'Write',
              'Bash(git push:*)', 'Bash(gh pr create:*)', 'Bash(gh pr comment:*)',
              'Bash(gh pr edit:*)', 'Bash(gh issue comment:*)')
}

function Write-Log([string]$Message) {
  $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Role, $Message
  Write-Host $line
  Add-Content -Path (Join-Path $LogDir "$Role-watch.log") -Value $line -Encoding UTF8
}

function Invoke-Gh([string[]]$GhArgs) {
  $out = & gh @GhArgs
  if ($LASTEXITCODE -ne 0) { throw ('gh {0} failed (exit {1})' -f ($GhArgs -join ' '), $LASTEXITCODE) }
  return ($out -join "`n")
}

function Get-GhJson([string[]]$GhArgs) {
  $text = Invoke-Gh $GhArgs
  if ([string]::IsNullOrWhiteSpace($text)) { return @() }
  return @(ConvertFrom-Json -InputObject $text)
}

function Test-Label($Item, [string]$Name) {
  return @($Item.labels | ForEach-Object { $_.name }) -contains $Name
}

function Test-Stopped($Item) {
  foreach ($l in $StopLabels) { if (Test-Label $Item $l) { return $true } }
  return $false
}

function Test-CleanTree {
  $status = (& git status --porcelain) -join "`n"
  return [string]::IsNullOrWhiteSpace($status)
}

function Set-Labels([string]$Kind, [int]$Number, [string[]]$Add = @(), [string[]]$Remove = @()) {
  if ($DryRun) { Write-Log "[dry-run] $Kind #$Number labels +$($Add -join ',') -$($Remove -join ',')"; return }
  $ghArgs = @($Kind, 'edit', "$Number")
  foreach ($l in $Add) { $ghArgs += @('--add-label', $l) }
  foreach ($l in $Remove) { $ghArgs += @('--remove-label', $l) }
  Invoke-Gh $ghArgs | Out-Null
}

function Add-Comment([string]$Kind, [int]$Number, [string]$Body) {
  if ($DryRun) { Write-Log "[dry-run] comment on $Kind #${Number}: $Body"; return }
  Invoke-Gh @($Kind, 'comment', "$Number", '--body', $Body) | Out-Null
}

# Runs one .claude/commands/<Command>.md headless. The prompt is plain ASCII without quotes so
# Windows PowerShell 5.1 passes it to claude.exe unchanged.
function Invoke-Claude([string]$Command, [int]$Argument) {
  if ($DryRun) { Write-Log "[dry-run] would run /$Command $Argument"; return $true }
  $prompt = "Follow the instructions in .claude/commands/$Command.md exactly, with ARGUMENTS = $Argument. " +
    'You are running unattended from scripts/agents/watch.ps1, so nobody can answer questions. ' +
    'If you are blocked or need a decision only the user can make, write it as a comment on the issue or PR and stop. ' +
    'Write temporary files only inside .agent-logs/.'
  $log = Join-Path $LogDir ('{0}-{1}-{2}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), $Command, $Argument)
  $kind = if ($Command -eq 'sl-implement') { 'builder' } else { 'lead' }
  $claudeArgs = @('-p', $prompt, '--permission-mode', $Mode[$kind], '--max-turns', "$MaxTurns",
                  '--allowedTools') + $Allowed[$kind]
  Write-Log "start /$Command $Argument (log: $log)"
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'   # native stderr must not abort the watcher
  try {
    & claude @claudeArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $log | Out-Host
    $ok = ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $previous
  }
  Write-Log ("end /$Command $Argument -> " + $(if ($ok) { 'ok' } else { "failed (exit $LASTEXITCODE)" }))
  return $ok
}

function Invoke-GitQuiet([string[]]$GitArgs) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & git @GitArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $previous }
}

$script:Me = $null
function Get-Me {
  if (-not $script:Me) { $script:Me = (Invoke-Gh @('api', 'user', '--jq', '.login')).Trim() }
  return $script:Me
}

function Step-Ping {
  $marker = "pong:$Role"
  foreach ($issue in (Get-GhJson @('issue', 'list', '--state', 'open', '--label', 'agent-ping', '--json', 'number,comments'))) {
    $done = @($issue.comments | Where-Object { $_.body -like "*$marker*" }).Count -gt 0
    if ($done) { continue }
    Add-Comment 'issue' $issue.number ("{0} from @{1} at {2}" -f $marker, (Get-Me), (Get-Date -Format 'yyyy-MM-dd HH:mm'))
    Write-Log "answered ping on issue #$($issue.number)"
  }
}

function Get-Logins($Item) {
  return @($Item.assignees | ForEach-Object { $_.login })
}

# True when another account has claimed the item (assigned itself).
function Test-TakenByOther($Item) {
  $me = Get-Me
  return @(Get-Logins $Item | Where-Object { $_ -ne $me }).Count -gt 0
}

# Claims an issue by assigning this account. If the other machine claimed it in the same
# moment, the alphabetically first login keeps it (both machines decide the same way).
function Request-Issue([int]$Number) {
  if ($DryRun) { Write-Log "[dry-run] would claim issue #$Number"; return $true }
  Invoke-Gh @('issue', 'edit', "$Number", '--add-assignee', '@me') | Out-Null
  $now = Get-GhJson @('issue', 'view', "$Number", '--json', 'assignees')
  $logins = @(Get-Logins $now[0])
  $me = Get-Me
  if (@($logins | Where-Object { $_ -ne $me }).Count -eq 0) { return $true }
  $winner = @($logins | Sort-Object)[0]
  if ($winner -eq $me) { return $true }
  Invoke-Gh @('issue', 'edit', "$Number", '--remove-assignee', '@me') | Out-Null
  Write-Log "issue #$Number was claimed by @$winner at the same time; leaving it"
  return $false
}

function Step-Review {
  $prs = Get-GhJson @('pr', 'list', '--state', 'open', '--label', 'needs-review', '--json', 'number,labels,author,reviews')
  foreach ($pr in $prs) {
    if (Test-Stopped $pr) { continue }
    if ($pr.author.login -eq (Get-Me)) {
      Write-Log "skip PR #$($pr.number): opened by this account, the other GitHub account must review it"
      continue
    }
    $rounds = @($pr.reviews | Where-Object { $_.state -eq 'CHANGES_REQUESTED' }).Count
    if ($rounds -ge $MaxReviewRounds) {
      Set-Labels 'pr' $pr.number @('needs-human') @('needs-review')
      Add-Comment 'pr' $pr.number "Đã qua $rounds vòng yêu cầu sửa. Dừng tự động, cần người dùng xem."
      Write-Log "PR #$($pr.number): $rounds review rounds, handed to the user"
      continue
    }
    if ($Role -eq 'both' -and -not (Test-CleanTree)) {
      Write-Log 'skip review: the working tree has uncommitted changes'
      return $false
    }
    if (Invoke-Claude 'sl-review' $pr.number) {
      if (-not (Test-CleanTree)) { Write-Log "warning: review of PR #$($pr.number) left local changes" }
    } else {
      Set-Labels 'pr' $pr.number @('agent-failed') @()
    }
    Invoke-GitQuiet @('switch', 'main')
    return $true
  }
  return $false
}

function Step-Plan {
  $issues = Get-GhJson @('issue', 'list', '--state', 'open', '--label', 'needs-plan', '--json', 'number,labels,assignees')
  foreach ($issue in $issues) {
    if ((Test-Stopped $issue) -or (Test-TakenByOther $issue)) { continue }
    if ($Role -eq 'both' -and -not (Request-Issue $issue.number)) { continue }
    if (Invoke-Claude 'sl-plan' $issue.number) {
      Set-Labels 'issue' $issue.number @() @('needs-plan')
    } else {
      Set-Labels 'issue' $issue.number @('agent-failed') @()
    }
    return $true
  }
  return $false
}

function Step-Rework {
  $prs = Get-GhJson @('pr', 'list', '--state', 'open', '--label', 'changes-requested', '--json', 'number,labels,author,closingIssuesReferences')
  foreach ($pr in $prs) {
    if (Test-Stopped $pr) { continue }
    # One issue = one branch = one machine: a "both" machine only reworks its own PRs.
    if ($Role -eq 'both' -and $pr.author.login -ne (Get-Me)) { continue }
    $linked = @($pr.closingIssuesReferences)
    if ($linked.Count -eq 0) {
      Set-Labels 'pr' $pr.number @('needs-human') @()
      Add-Comment 'pr' $pr.number 'PR không có dòng "Closes #<issue>", máy viết code không biết kế hoạch nào. Cần người dùng xem.'
      continue
    }
    if (-not (Invoke-Claude 'sl-implement' $linked[0].number)) { Set-Labels 'pr' $pr.number @('agent-failed') @() }
    Invoke-GitQuiet @('switch', 'main')
    return $true
  }
  return $false
}

function Step-Implement {
  # "in-progress" means a machine has taken the issue (it stays on while the PR is open; the
  # issue closes when the PR is merged). The assignee says which machine.
  $issues = Get-GhJson @('issue', 'list', '--state', 'open', '--label', 'approved', '--json', 'number,labels,assignees')
  foreach ($issue in $issues) {
    if ((Test-Stopped $issue) -or (Test-Label $issue 'in-progress') -or (Test-TakenByOther $issue)) { continue }
    if (-not (Request-Issue $issue.number)) { continue }
    Set-Labels 'issue' $issue.number @('in-progress') @()
    if (-not (Invoke-Claude 'sl-implement' $issue.number)) {
      Set-Labels 'issue' $issue.number @('agent-failed') @('in-progress')
    }
    Invoke-GitQuiet @('switch', 'main')
    return $true
  }
  return $false
}

function Step-Code {
  if (-not (Test-CleanTree)) {
    Write-Log 'skip coding: the working tree has uncommitted changes (someone is working here)'
    return $false
  }
  if (Step-Rework) { return $true }
  return (Step-Implement)
}

function Invoke-Cycle {
  switch ($Role) {
    'lead'    { if (-not (Step-Review)) { [void](Step-Plan) } }
    'builder' { [void](Step-Code) }
    'both'    {
      # Review first (it unblocks the other machine), then own rework, plan, new code.
      if (Step-Review) { return }
      if (-not (Test-CleanTree)) { Write-Log 'skip cycle: the working tree has uncommitted changes'; return }
      if (Step-Rework) { return }
      if (Step-Plan) { return }
      [void](Step-Implement)
    }
  }
}

# --- main -----------------------------------------------------------------------------------

foreach ($tool in @('git', 'gh', 'claude')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "'$tool' was not found on PATH" }
}

if (Test-Path $LockFile) {
  $old = (Get-Content $LockFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($old -and (Get-Process -Id ([int]$old) -ErrorAction SilentlyContinue)) {
    Write-Log "another $Role watcher is running (PID $old); exiting"
    exit 0
  }
}
Set-Content -Path $LockFile -Value $PID

try {
  Write-Log ("watching as @{0}, every {1} min{2}" -f (Get-Me), $IntervalMinutes, $(if ($DryRun) { ' (dry run)' } else { '' }))
  while ($true) {
    try {
      Step-Ping
      Invoke-Cycle
    } catch {
      Write-Log "cycle error: $($_.Exception.Message)"
    }
    if ($Once) { break }
    Start-Sleep -Seconds ($IntervalMinutes * 60)
  }
} finally {
  Remove-Item $LockFile -ErrorAction SilentlyContinue
}
