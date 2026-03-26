#!/usr/bin/env bash
# check-server-only.sh
# Ensures every file under lib/ starts with `import "server-only"`.
# Run manually or in CI (before tests / after build).
# Exit code 1 = violations found.

set -euo pipefail

LIB_DIR="$(cd "$(dirname "$0")/.." && pwd)/lib"
VIOLATIONS=()

# Pure utility files that are safe to import from client components.
# These must NOT have server-only (would break client bundles).
EXCLUDED_PATTERNS=(
  "lib/formatYear.ts"
)

is_excluded() {
  local file="$1"
  for pattern in "${EXCLUDED_PATTERNS[@]}"; do
    if [[ "$file" == *"$pattern" ]]; then
      return 0
    fi
  done
  return 1
}

while IFS= read -r -d '' file; do
  if is_excluded "$file"; then
    continue
  fi
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
