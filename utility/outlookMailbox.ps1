# Read the signed-in Outlook profile's inbox through COM.
#
# This is the local backend for mailbox-backed tests: it reuses the Outlook
# profile already authenticated as the current Windows user, so no app
# registration, admin consent or password is involved. It only works on a
# machine with Outlook installed and configured (i.e. a developer workstation),
# which is why the Graph backend exists for CI.
#
# Emits a single JSON object on stdout.
#
#   -Recipient        plus-addressed address to match on the To header
#   -TimeoutSeconds   how long to keep polling for delivery
#   -ScanCount        how many of the most recent messages to examine

param(
  [Parameter(Mandatory = $true)][string]$Recipient,
  [int]$TimeoutSeconds = 180,
  [int]$ScanCount = 60,
  # Optional: only match messages whose subject matches this regex.
  [string]$SubjectMatch = '',
  # Optional: ignore messages whose subject matches this regex (e.g. the
  # verification e-mail when waiting for a later status notification).
  [string]$SubjectNotLike = '',
  # Optional ISO-8601 lower bound: only match messages received at/after this.
  [string]$SinceIso = ''
)

$ErrorActionPreference = 'Stop'

function Write-Result($obj) {
  $obj | ConvertTo-Json -Compress -Depth 4
  exit 0
}

try {
  $outlook = New-Object -ComObject Outlook.Application
  $namespace = $outlook.GetNamespace('MAPI')
  $inbox = $namespace.GetDefaultFolder(6)   # olFolderInbox
} catch {
  Write-Result @{ found = $false; error = "Outlook COM unavailable: $($_.Exception.Message)" }
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$target = $Recipient.ToLower()

while ((Get-Date) -lt $deadline) {
  $items = $inbox.Items
  $items.Sort('[ReceivedTime]', $true)

  $index = 0
  foreach ($message in $items) {
    $index++
    if ($index -gt $ScanCount) { break }

    $to = ''
    try { $to = [string]$message.To } catch { $to = '' }
    if (-not $to -or $to.ToLower() -notlike "*$target*") { continue }

    $subject = [string]$message.Subject
    if ($SubjectMatch -and ($subject -notmatch $SubjectMatch)) { continue }
    if ($SubjectNotLike -and ($subject -match $SubjectNotLike)) { continue }
    if ($SinceIso) {
      try { if ($message.ReceivedTime -lt [datetime]::Parse($SinceIso)) { continue } } catch {}
    }

    $html = ''
    try { $html = [string]$message.HTMLBody } catch { $html = '' }

    # Anchors whose visible text mentions verifying: that is the call to action.
    # The href is usually a HubSpot tracking redirect, not a link on the
    # application host, so it must be followed rather than pattern-matched.
    $verifyLinks = @()
    foreach ($m in [regex]::Matches($html, '<a\b[^>]*href\s*=\s*["'']([^"'']+)["''][^>]*>(.*?)</a>',
        [System.Text.RegularExpressions.RegexOptions]::Singleline -bor
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
      $href = $m.Groups[1].Value
      $text = [regex]::Replace($m.Groups[2].Value, '<[^>]+>', ' ')
      if ($text -match 'verify|confirm|activate') {
        $verifyLinks += ($href -replace '&amp;', '&')
      }
    }

    $allLinks = @()
    foreach ($m in [regex]::Matches($html, 'href\s*=\s*["'']([^"'']+)["'']',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
      $allLinks += ($m.Groups[1].Value -replace '&amp;', '&')
    }

    Write-Result @{
      found        = $true
      subject      = [string]$message.Subject
      to           = $to
      receivedTime = $message.ReceivedTime.ToString('o')
      verifyLinks  = @($verifyLinks | Select-Object -Unique)
      linkCount    = $allLinks.Count
    }
  }

  Start-Sleep -Seconds 5
}

Write-Result @{ found = $false; error = "No message to $Recipient arrived within $TimeoutSeconds seconds." }
