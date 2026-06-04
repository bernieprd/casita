#!/usr/bin/env bash
# Reset a user account so they can re-register via the UI.
# Usage: ./scripts/reset-user.sh <email>
set -euo pipefail

EMAIL="${1:?Usage: $0 <email>}"
KV_NAMESPACE_ID="2d412d6c4d5e4f6fbc17b2aae06de761"

npx wrangler kv key delete --namespace-id "$KV_NAMESPACE_ID" --remote "user:$EMAIL"
echo "Account for $EMAIL deleted. They can now re-register at the site."
