$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$entries = [Console]::ReadLine() | ConvertFrom-Json
$root = Join-Path $PSScriptRoot 'fixtures/uat-fleet'
New-Item -ItemType Directory -Force -Path $root | Out-Null
foreach ($entry in $entries) {
    if ($entry.filename -notmatch '^[a-z0-9-]+\.png$') { throw 'Invalid fixture filename' }
    $target = Join-Path $root $entry.filename
    if (Test-Path -LiteralPath $target) { continue }
    $bitmap = New-Object System.Drawing.Bitmap(960, 600)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $title = New-Object System.Drawing.Font('Arial', 28, [System.Drawing.FontStyle]::Bold)
    $subtitle = New-Object System.Drawing.Font('Arial', 18)
    try {
        $graphics.Clear([System.Drawing.Color]::FromArgb(19, 35, 57))
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.FillRectangle([System.Drawing.Brushes]::SteelBlue, 160, 275, 640, 120)
        $graphics.FillPolygon([System.Drawing.Brushes]::LightSteelBlue, [System.Drawing.Point[]]@(
            [System.Drawing.Point]::new(280, 275), [System.Drawing.Point]::new(350, 195),
            [System.Drawing.Point]::new(600, 195), [System.Drawing.Point]::new(685, 275)))
        $graphics.FillEllipse([System.Drawing.Brushes]::Black, 240, 345, 100, 100)
        $graphics.FillEllipse([System.Drawing.Brushes]::Black, 625, 345, 100, 100)
        $graphics.DrawString($entry.label, $title, [System.Drawing.Brushes]::White, 40, 45)
        $graphics.DrawString($entry.view + ' - labeled UAT placeholder', $subtitle, [System.Drawing.Brushes]::LightSteelBlue, 40, 105)
        $graphics.DrawString('LOCAL TEST FIXTURE / NOT A VEHICLE PHOTOGRAPH', $subtitle, [System.Drawing.Brushes]::White, 40, 515)
        $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $subtitle.Dispose(); $title.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
