#!/usr/bin/env bash
# =============================================================================
# scripts/setup.sh — ONE-TIME frontend infrastructure setup
# Run from Git Bash on Windows, or any bash on Mac/Linux.
#
# Creates: S3 bucket · CloudFront distribution · Route 53 alias record
# Uses the existing *.abhijeetkharkar.com wildcard cert — no new cert needed.
#
# Usage:
#   bash scripts/setup.sh
# =============================================================================
set -euo pipefail

PROFILE="admin"
DOMAIN="tracker.abhijeetkharkar.com"
APEX="abhijeetkharkar.com"
BUCKET="tracker.abhijeetkharkar.com"
REGION="us-east-1"

echo ""
echo "=== tracker.abhijeetkharkar.com — infrastructure setup ==="
echo ""

# ── 1. Resolve project root ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# node helper: parse a JSON field from stdin
# Usage: echo "$JSON" | json_field "FieldName"
json_field() {
  node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>console.log(JSON.parse(s).$1));"
}

# ── 2. Look up Route 53 hosted zone ID ───────────────────────────────────────
echo "▶ Looking up Route 53 hosted zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${APEX}." \
  --profile "$PROFILE" \
  --query 'HostedZones[0].Id' \
  --output text | cut -d'/' -f3)
echo "  Hosted zone ID: $HOSTED_ZONE_ID"

# ── 3. Find existing wildcard ACM cert ────────────────────────────────────────
echo "▶ Looking up wildcard ACM certificate (*.abhijeetkharkar.com)..."
CERT_ARN=$(aws acm list-certificates \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "CertificateSummaryList[?DomainName=='abhijeetkharkar.com' && Status=='ISSUED'].CertificateArn | [0]" \
  --output text)

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" = "None" ]; then
  echo "✗ Could not find issued ACM cert for abhijeetkharkar.com in us-east-1"
  exit 1
fi
echo "  Certificate ARN: $CERT_ARN"

# ── 4. Create S3 bucket ───────────────────────────────────────────────────────
echo "▶ Creating S3 bucket: $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" 2>/dev/null; then
  echo "  Bucket already exists — skipping"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --profile "$PROFILE"
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --profile "$PROFILE" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "  Bucket ready ✓"

# ── 5. CloudFront Origin Access Control ──────────────────────────────────────
echo "▶ Creating Origin Access Control..."
OAC_ID=$(aws cloudfront create-origin-access-control \
  --profile "$PROFILE" \
  --origin-access-control-config \
    "Name=${BUCKET}-oac,Description=OAC for ${DOMAIN},SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
  --query 'OriginAccessControl.Id' \
  --output text)
echo "  OAC ID: $OAC_ID"

# ── 6. Create CloudFront distribution ────────────────────────────────────────
echo "▶ Creating CloudFront distribution..."

DIST_CONFIG=$(cat <<EOF
{
  "CallerReference": "tracker-$(date +%s)",
  "Comment": "tracker.abhijeetkharkar.com",
  "Aliases": { "Quantity": 1, "Items": ["$DOMAIN"] },
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "s3-origin",
      "DomainName": "${BUCKET}.s3.${REGION}.amazonaws.com",
      "OriginAccessControlId": "$OAC_ID",
      "S3OriginConfig": { "OriginAccessIdentity": "" }
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "AllowedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 404,
      "ResponsePagePath": "/index.html",
      "ResponseCode": "200",
      "ErrorCachingMinTTL": 0
    }]
  },
  "ViewerCertificate": {
    "ACMCertificateArn": "$CERT_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "PriceClass": "PriceClass_100",
  "Enabled": true,
  "HttpVersion": "http2"
}
EOF
)

DIST_OUTPUT=$(aws cloudfront create-distribution \
  --profile "$PROFILE" \
  --distribution-config "$DIST_CONFIG")

DIST_ID=$(echo "$DIST_OUTPUT" | node -e \
  "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>console.log(JSON.parse(s).Distribution.Id));")
DIST_DOMAIN=$(echo "$DIST_OUTPUT" | node -e \
  "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>console.log(JSON.parse(s).Distribution.DomainName));")

echo "  Distribution ID:   $DIST_ID"
echo "  CloudFront domain: $DIST_DOMAIN"

# ── 7. S3 bucket policy ───────────────────────────────────────────────────────
echo "▶ Attaching bucket policy..."
ACCOUNT_ID=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)

aws s3api put-bucket-policy --bucket "$BUCKET" --profile "$PROFILE" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"AllowCloudFrontOAC\",
    \"Effect\": \"Allow\",
    \"Principal\": { \"Service\": \"cloudfront.amazonaws.com\" },
    \"Action\": \"s3:GetObject\",
    \"Resource\": \"arn:aws:s3:::${BUCKET}/*\",
    \"Condition\": {
      \"StringEquals\": {
        \"AWS:SourceArn\": \"arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}\"
      }
    }
  }]
}"
echo "  Bucket policy applied ✓"

# ── 8. Route 53 alias record ──────────────────────────────────────────────────
echo "▶ Creating Route 53 alias: $DOMAIN → CloudFront..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --profile "$PROFILE" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"CREATE\",
      \"ResourceRecordSet\": {
        \"Name\": \"$DOMAIN\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
          \"DNSName\": \"$DIST_DOMAIN\",
          \"EvaluateTargetHealth\": false
        }
      }
    }]
  }" > /dev/null
echo "  DNS record created ✓"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Frontend infrastructure ready!"
echo ""
echo "  Paste this into setup-lambda.sh AND deploy.sh:"
echo "  CLOUDFRONT_ID=\"$DIST_ID\""
echo ""
echo "  Then run: bash scripts/setup-lambda.sh"
echo "  ⚠️  Wait 5–15 min for CloudFront to deploy globally first."
echo ""
