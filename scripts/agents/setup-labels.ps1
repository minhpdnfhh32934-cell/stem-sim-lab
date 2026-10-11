<#
.SYNOPSIS
  Creates (or updates) the GitHub labels used by the two-machine workflow. Safe to run again.
#>
$ErrorActionPreference = 'Stop'
$labels = @(
  @('needs-plan',        'C5DEF5', 'Lead should write a plan for this issue'),
  @('plan',              '1D76DB', 'Plan written by the Lead machine'),
  @('approved',          '0E8A16', 'User approved the plan'),
  @('in-progress',       'BFD4F2', 'Builder machine took this issue'),
  @('needs-review',      'FBCA04', 'PR waiting for the Lead review'),
  @('changes-requested', 'D93F0B', 'Review asked for changes'),
  @('ready-to-merge',    '5319E7', 'Review passed, waiting for the user to merge'),
  @('needs-human',       'B60205', 'Automatic loop stopped, the user must look'),
  @('agent-failed',      '000000', 'A Claude run failed, see .agent-logs on that machine'),
  @('agent-ping',        'EDEDED', 'Connection test between the two machines')
)
foreach ($l in $labels) {
  & gh label create $l[0] --color $l[1] --description $l[2] --force
  if ($LASTEXITCODE -ne 0) { throw "could not create label $($l[0])" }
}
Write-Host "OK: $($labels.Count) labels"
