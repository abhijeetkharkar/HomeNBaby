#!/usr/bin/env bash
# =============================================================================
# scripts/setup-ses.sh — ONE-TIME SES domain verification
# Verifies tracker.abhijeetkharkar.com in SES and adds DKIM records to Route 53.
# Run this once. SES auto-verifies within 72h once DNS propagates.
#
# Usage:
#   bash scripts/setup-ses.sh
# =============================================================================
set -euo pipefail

PROFILE="admin"
REGION="us-east-1"
APEX="abhijeetkharkar.com"
DOMAIN="tracker.abhijeetkharkar.com"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       SES Domain Verification Setup             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Get Route 53 hosted zone ID ───────────────────────────────────────────────
echo "▶ Looking up Route 53 hosted zone..."
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${APEX}." \
  --profile "$PROFILE" \
  --query 'HostedZones[0].Id' \
  --output text | cut -d'/' -f3)
echo "  Zone ID: $HOSTED_ZONE_ID"

# ── Check current verification status ────────────────────────────────────────
echo ""
echo "▶ Checking SES domain identity for $DOMAIN..."
VERIFY_STATUS=$(aws sesv2 get-email-identity \
  --email-identity "$DOMAIN" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query 'VerifiedForSendingStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$VERIFY_STATUS" = "True" ]; then
  echo "  ✅ Domain already verified — nothing to do!"
  exit 0
fi

# ── Create SES domain identity (idempotent) ───────────────────────────────────
echo "  Creating SES domain identity..."
aws sesv2 create-email-identity \
  --email-identity "$DOMAIN" \
  --dkim-signing-attributes 'NextSigningKeyLength=RSA_2048_BIT' \
  --profile "$PROFILE" \
  --region "$REGION" > /dev/null 2>&1 || true  # ignore AlreadyExistsException

# ── Fetch DKIM tokens ─────────────────────────────────────────────────────────
echo "▶ Fetching DKIM tokens from SES..."
DKIM_TOKENS=$(aws sesv2 get-email-identity \
  --email-identity "$DOMAIN" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --query 'DkimAttributes.Tokens' \
  --output json)

TOKEN_LIST=$(echo "$DKIM_TOKENS" | node -e \
  "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>JSON.parse(s).forEach(t=>console.log(t)));")

echo "  Tokens:"
echo "$TOKEN_LIST" | while read -r t; do echo "    $t._domainkey.$DOMAIN → $t.dkim.amazonses.com"; done

# ── Add DKIM CNAME records to Route 53 ───────────────────────────────────────
echo ""
echo "▶ Adding DKIM CNAME records to Route 53..."

CHANGES="["
FIRST=true
while IFS= read -r TOKEN; do
  if [ "$FIRST" = "true" ]; then FIRST=false; else CHANGES+=","; fi
  CHANGES+="{
    \"Action\": \"UPSERT\",
    \"ResourceRecordSet\": {
      \"Name\": \"${TOKEN}._domainkey.${DOMAIN}\",
      \"Type\": \"CNAME\",
      \"TTL\": 300,
      \"ResourceRecords\": [{\"Value\": \"${TOKEN}.dkim.amazonses.com\"}]
    }
  }"
done <<< "$TOKEN_LIST"
CHANGES+="]"

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --profile "$PROFILE" \
  --change-batch "{\"Changes\": $CHANGES}" > /dev/null

echo "  DKIM records added to Route 53 ✓"

echo ""
echo "✅ SES setup complete!"
echo ""
echo "  DNS will propagate within 72h. SES will auto-verify once done."
echo "  Check status anytime with:"
echo "  aws sesv2 get-email-identity --email-identity $DOMAIN --profile admin --region $REGION --query 'VerifiedForSendingStatus'"
echo ""
