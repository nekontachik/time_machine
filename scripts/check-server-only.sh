#!/usr/bin/env bash
# check-server-only.sh
# Ensures every file under lib/ starts with `import "server-only"`.
# Run manually or in CI (before tests / after build).
# Exit code 1 = violations found.

set -euo pipefail

LIB_DIR="$(cd "$(dirname "$0")/.." && pwd)/lib"
VIOLATIONS=()

while IFS= read -r -d '' file; do
  # Check if the very first non-empty, non-comment line is `import "server-only"`
  first_import=$(grep -m 1 'import ' "$file" 2>/dev/null || true)
  if [[ "$first_import" != *'import "server-only"'* ]]; then
    VIOLATIONS+=("$file")
  fi
done < <(find "$LIB_DIR" -name "*.ts" -print0)

if [[ ${#VIOLATIONS[@]} -eq 0 ]]; then
  echo "✅  All lib/ files have 'import \"server-only\"' — boundary is clean."
  exit 0
fi

echo "❌  Missing 'import \"server-only\"' in the following lib/ files:"
for f in "${VIOLATIONS[@]}"; do
  echo "    $f"
done
echo ""
echo "Fix: add  import \"server-only\";  as the FIRST line of each file above."
exit 1
