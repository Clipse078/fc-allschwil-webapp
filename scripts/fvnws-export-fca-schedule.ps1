param(
  [string]$ClubScheduleUrl = "https://matchcenter.fvnws.ch/default.aspx?a=vs&lng=1&oid=8&v=483",
  [string]$OutCsv = ".\exports\fvnws-fc-allschwil-schedule.csv"
)

$ErrorActionPreference = "Stop"

function Convert-HtmlToLines {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Html
  )

  $text = $Html

  $text = [System.Text.RegularExpressions.Regex]::Replace(
    $text,
    "<script[\s\S]*?</script>",
    "",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  $text = [System.Text.RegularExpressions.Regex]::Replace(
    $text,
    "<style[\s\S]*?</style>",
    "",
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
  )

  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "<br\s*/?>", "`n", "IgnoreCase")
  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "</p>", "`n", "IgnoreCase")
  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "</div>", "`n", "IgnoreCase")
  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "</li>", "`n", "IgnoreCase")
  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "</tr>", "`n", "IgnoreCase")
  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "</td>", " ", "IgnoreCase")
  $text = [System.Text.RegularExpressions.Regex]::Replace($text, "<[^>]+>", " ")

  $text = [System.Net.WebUtility]::HtmlDecode($text)
  $text = $text -replace "`r", ""
  $text = $text -replace "`t", " "
  $text = $text -replace " ", " "
  $text = $text -replace "[ ]{2,}", " "

  $lines = $text -split "`n" |
    ForEach-Object { $_.Trim() } |
    Where-Object {
      $_ -and
      $_ -notmatch "^(Verein|Spielbetrieb|Teams|Vereinsspielplan|Heimspielplan|Aktuelle Spiele|Resultate \+ Ranglisten|Strafen|Suspensionen/Funktionssperren)$" -and
      $_ -notmatch "^FC Allschwil$" -and
      $_ -notmatch "^www\.fcallschwil\.ch$" -and
      $_ -notmatch "^Match center$"
    }

  return $lines
}

function Test-DateLine {
  param([string]$Value)
  return $Value -match "^(Mo|Di|Mi|Do|Fr|Sa|So)\s+\d{2}\.\d{2}\.\d{4}$"
}

function Test-TimeLine {
  param([string]$Value)
  return $Value -match "^\d{2}:\d{2}$"
}

function Test-SpielnummerLine {
  param([string]$Value)
  return $Value -match "^Spielnummer\s*\d+"
}

function Test-CompetitionLine {
  param([string]$Value)
  return $Value -match "^(Meisterschaft|Cup|Turnier)"
}

function Test-OrganizerLine {
  param([string]$Value)
  return $Value -match "^Organisator:"
}

function Get-DateTimeIso {
  param(
    [Parameter(Mandatory = $true)][string]$SwissDate,
    [Parameter(Mandatory = $true)][string]$Time
  )

  $dt = [datetime]::ParseExact(
    "$SwissDate $Time",
    "dd.MM.yyyy HH:mm",
    [System.Globalization.CultureInfo]::InvariantCulture
  )

  return $dt.ToString("yyyy-MM-ddTHH:mm:ss")
}

function Get-ClubTeamName {
  param(
    [string]$Home,
    [string]$Away
  )

  if ($Home -match "FC Allschwil") { return $Home }
  if ($Away -match "FC Allschwil") { return $Away }
  return $null
}

function Get-OpponentName {
  param(
    [string]$Home,
    [string]$Away
  )

  if ($Home -match "FC Allschwil") { return $Away }
  if ($Away -match "FC Allschwil") { return $Home }
  return $null
}

function Get-HomeAway {
  param(
    [string]$Home,
    [string]$Away
  )

  if ($Home -match "FC Allschwil") { return "HOME" }
  if ($Away -match "FC Allschwil") { return "AWAY" }
  return $null
}

function Get-Spielnummer {
  param([string]$Value)

  $m = [regex]::Match($Value, "(\d+)")
  if ($m.Success) { return $m.Groups[1].Value }
  return $null
}

Write-Output "▶ Downloading FVNWS club schedule page..."
$response = Invoke-WebRequest -Uri $ClubScheduleUrl -UseBasicParsing
Write-Output "✅ Done: downloaded FVNWS club schedule page."

Write-Output "▶ Converting HTML to normalized line stream..."
$lines = Convert-HtmlToLines -Html $response.Content
Write-Output ("✅ Done: extracted " + $lines.Count + " normalized text lines.")

$events = New-Object System.Collections.Generic.List[object]

$currentDate = $null
$i = 0

Write-Output "▶ Parsing fixtures and tournaments..."

while ($i -lt $lines.Count) {
  $line = $lines[$i]

  if (Test-DateLine $line) {
    $currentDate = $line.Substring($line.Length - 10)
    $i++
    continue
  }

  if (-not $currentDate) {
    $i++
    continue
  }

  if (-not (Test-TimeLine $line)) {
    $i++
    continue
  }

  $time = $line
  $startAt = Get-DateTimeIso -SwissDate $currentDate -Time $time

  if (($i + 1) -ge $lines.Count) {
    break
  }

  $next = $lines[$i + 1]

  # Tournament block
  if ($next -match "^Turnier") {
    $title = $lines[$i + 1]
    $category = if (($i + 2) -lt $lines.Count) { $lines[$i + 2] } else { $null }
    $competition = if (($i + 3) -lt $lines.Count -and -not (Test-OrganizerLine $lines[$i + 3])) { $lines[$i + 3] } else { $null }

    $organizer = $null
    $location = $null
    $j = $i + 2

    while ($j -lt $lines.Count) {
      if (Test-DateLine $lines[$j] -or Test-TimeLine $lines[$j]) {
        break
      }

      if (Test-OrganizerLine $lines[$j]) {
        $organizer = ($lines[$j] -replace "^Organisator:\s*", "").Trim()
        if (($j + 1) -lt $lines.Count) {
          $location = $lines[$j + 1]
        }
        break
      }

      $j++
    }

    $events.Add([pscustomobject]@{
      sourceSystem       = "FVNWS"
      sourceUrl          = $ClubScheduleUrl
      eventType          = "TOURNAMENT"
      season             = ""
      date               = $currentDate
      time               = $time
      startAt            = $startAt
      team               = $category
      opponentName       = ""
      homeAway           = ""
      competitionLabel   = $competition
      organizerName      = $organizer
      location           = $location
      spielnummer        = ""
      title              = $title
    })

    $i = $j
    continue
  }

  # Match block
  if (($i + 3) -lt $lines.Count -and $lines[$i + 2] -eq "-") {
    $home = $lines[$i + 1]
    $away = $lines[$i + 3]

    $competition = $null
    $spielnummer = $null
    $location = $null

    $j = $i + 4

    while ($j -lt $lines.Count) {
      $candidate = $lines[$j]

      if (Test-DateLine $candidate -or Test-TimeLine $candidate) {
        break
      }

      if (Test-CompetitionLine $candidate) {
        $competition = $candidate
      }
      elseif (Test-SpielnummerLine $candidate) {
        $spielnummer = Get-Spielnummer $candidate
      }
      elseif (-not $location -and $spielnummer) {
        $location = $candidate
        break
      }

      $j++
    }

    $clubTeam = Get-ClubTeamName -Home $home -Away $away
    $opponent = Get-OpponentName -Home $home -Away $away
    $homeAway = Get-HomeAway -Home $home -Away $away

    $title = if ($clubTeam -and $opponent) {
      "$clubTeam vs $opponent"
    } else {
      "$home vs $away"
    }

    $events.Add([pscustomobject]@{
      sourceSystem       = "FVNWS"
      sourceUrl          = $ClubScheduleUrl
      eventType          = "MATCH"
      season             = ""
      date               = $currentDate
      time               = $time
      startAt            = $startAt
      team               = $clubTeam
      opponentName       = $opponent
      homeAway           = $homeAway
      competitionLabel   = $competition
      organizerName      = ""
      location           = $location
      spielnummer        = $spielnummer
      title              = $title
    })

    $i = $j
    continue
  }

  $i++
}

$outDir = Split-Path -Parent $OutCsv
if (-not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  Write-Output ("✅ Done: created output directory " + $outDir)
}

Write-Output "▶ Exporting CSV..."
$events |
  Sort-Object startAt, eventType, team, title |
  Export-Csv -Path $OutCsv -NoTypeInformation -Encoding UTF8
Write-Output ("✅ Done: wrote CSV to " + $OutCsv)

Write-Output "▶ Preview first 12 rows..."
$events |
  Sort-Object startAt, eventType, team, title |
  Select-Object -First 12 |
  Format-Table date, time, eventType, team, opponentName, organizerName, competitionLabel, location -AutoSize

Write-Output ("✅ Done: parsed " + $events.Count + " schedule entries from FVNWS.")