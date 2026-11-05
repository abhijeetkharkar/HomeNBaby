<#
.SYNOPSIS
Converts generated plant images to true high-quality JPEG (92% quality) in the artifact folder (<ArtifactDir>/<id>.jpg),
and optionally uploads them directly to both production S3 buckets and invalidates CloudFront (without storing images in Git).

.EXAMPLE
# Step 1: Convert raw generated image(s) to 92%-quality JPEG <ArtifactDir>/<id>.jpg (before S3 upload)
powershell -ExecutionPolicy Bypass -File .agents/skills/plant-image-generator/scripts/publish-images.ps1 `
  -PlantId "monstera-deliciosa" `
  -SourcePath "C:\path\to\monstera_deliciosa_123.jpg" `
  -ArtifactDir "C:\path\to\artifact-dir"

# Step 2: Upload approved <ArtifactDir>/<id>.jpg files directly to S3 & invalidate CloudFront
powershell -ExecutionPolicy Bypass -File .agents/skills/plant-image-generator/scripts/publish-images.ps1 `
  -PlantId "monstera-deliciosa","fiddle-leaf-fig" `
  -ArtifactDir "C:\path\to\artifact-dir" `
  -UploadToS3
#>
param(
  [Parameter(Mandatory = $true)]
  [string[]]$PlantId,

  [Parameter(Mandatory = $true)]
  [string]$ArtifactDir,

  [Parameter(Mandatory = $false)]
  [string[]]$SourcePath,

  [Parameter(Mandatory = $false)]
  [switch]$UploadToS3,

  [Parameter(Mandatory = $false)]
  [string]$Profile = "admin",

  [Parameter(Mandatory = $false)]
  [string]$Region = "us-east-1",

  [Parameter(Mandatory = $false)]
  [string]$FrontendBucket = "plants-frontend-prod-797884421713",

  [Parameter(Mandatory = $false)]
  [string]$CatalogBucket = "plants-catalog-images-prod-797884421713",

  [Parameter(Mandatory = $false)]
  [string]$DistributionId = "EH59GI05MOM4F"
)

$ErrorActionPreference = "Stop"
$PlantId = @($PlantId | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($SourcePath) {
  $SourcePath = @($SourcePath | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

if (-not (Test-Path $ArtifactDir)) {
  New-Item -ItemType Directory -Path $ArtifactDir -Force | Out-Null
}

if ($SourcePath -and $SourcePath.Count -gt 0) {
  if ($SourcePath.Count -ne $PlantId.Count) {
    throw "SourcePath count ($($SourcePath.Count)) must match PlantId count ($($PlantId.Count))."
  }
  Add-Type -AssemblyName System.Drawing
  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)

  for ($i = 0; $i -lt $PlantId.Count; $i++) {
    $id = $PlantId[$i]
    $src = $SourcePath[$i]
    $dstArt = Join-Path $ArtifactDir "$id.jpg"
    $img = [System.Drawing.Image]::FromFile($src)
    $img.Save($dstArt, $jpegCodec, $ep)
    $img.Dispose()
    Write-Output "Converted & saved $dstArt ($((Get-Item $dstArt).Length) bytes)"
  }
}

if ($UploadToS3) {
  $pathsToInvalidate = @()
  foreach ($id in $PlantId) {
    $localFile = Join-Path $ArtifactDir "$id.jpg"
    if (-not (Test-Path $localFile)) {
      throw "Local artifact image not found: $localFile"
    }
    Write-Output "Uploading $id.jpg to s3://$FrontendBucket/plants/$id.jpg ..."
    aws s3 cp $localFile "s3://$FrontendBucket/plants/$id.jpg" --content-type "image/jpeg" --region $Region --profile $Profile
    if ($LASTEXITCODE -ne 0) { throw "Failed uploading $id.jpg to $FrontendBucket" }

    Write-Output "Uploading $id.jpg to s3://$CatalogBucket/plants/$id.jpg ..."
    aws s3 cp $localFile "s3://$CatalogBucket/plants/$id.jpg" --content-type "image/jpeg" --region $Region --profile $Profile
    if ($LASTEXITCODE -ne 0) { throw "Failed uploading $id.jpg to $CatalogBucket" }

    $pathsToInvalidate += "/plants/$id.jpg"
  }

  Write-Output "Creating CloudFront invalidation on $DistributionId for $($pathsToInvalidate.Count) path(s)..."
  aws cloudfront create-invalidation --distribution-id $DistributionId --paths $pathsToInvalidate --region $Region --profile $Profile
  if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation failed" }
  Write-Output "Successfully uploaded and invalidated $($PlantId.Count) plant image(s)."
}
