param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Add-Type -AssemblyName System.Drawing

$resolvedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$targets = @(
  @{ Path = 'public\icons\icon-192.png'; Size = 192; Maskable = $false },
  @{ Path = 'public\icons\icon-512.png'; Size = 512; Maskable = $false },
  @{ Path = 'public\icons\maskable-512.png'; Size = 512; Maskable = $true },
  @{ Path = 'public\icons\apple-touch-icon.png'; Size = 180; Maskable = $false },
  @{ Path = 'extension\icons\icon16.png'; Size = 16; Maskable = $false },
  @{ Path = 'extension\icons\icon32.png'; Size = 32; Maskable = $false },
  @{ Path = 'extension\icons\icon48.png'; Size = 48; Maskable = $false },
  @{ Path = 'extension\icons\icon128.png'; Size = 128; Maskable = $false },
  @{ Path = 'build\icon.png'; Size = 512; Maskable = $false }
)

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($target in $targets) {
  $outputPath = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot $target.Path))
  if (-not $outputPath.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside project root: $outputPath"
  }

  $directory = Split-Path -Parent $outputPath
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }

  $size = [int]$target.Size
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $padding = if ($target.Maskable) { 0 } else { [Math]::Max(1, [Math]::Round($size * 0.04)) }
  $rect = New-Object System.Drawing.RectangleF(
    [float]$padding,
    [float]$padding,
    [float]($size - ($padding * 2)),
    [float]($size - ($padding * 2))
  )
  $radius = [Math]::Max(2, $size * 0.19)
  $shape = New-RoundedRectanglePath -Rectangle $rect -Radius $radius
  $startColor = [System.Drawing.Color]::FromArgb(255, 124, 58, 237)
  $endColor = [System.Drawing.Color]::FromArgb(255, 255, 77, 126)
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    $startColor,
    $endColor,
    35
  )
  $graphics.FillPath($gradient, $shape)

  if ($size -ge 48) {
    $highlight = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 255, 255, 255), [Math]::Max(1, $size * 0.012))
    $graphics.DrawPath($highlight, $shape)
    $highlight.Dispose()
  }

  $fontSize = [Math]::Max(10, $size * 0.52)
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $textRect = New-Object System.Drawing.RectangleF(0, [float](-$size * 0.035), $size, $size)
  $graphics.DrawString('S', $font, $textBrush, $textRect, $format)

  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $textBrush.Dispose()
  $format.Dispose()
  $font.Dispose()
  $gradient.Dispose()
  $shape.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Generated $($targets.Count) ScreenFlow icon assets."
