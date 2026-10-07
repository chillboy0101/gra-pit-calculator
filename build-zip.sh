#!/usr/bin/env bash
# Build the WordPress install zip. The zip must contain the folder
# gra-pit-calculator/ and must not contain .git.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$root/dist/gra-pit-calculator.zip}"
if [[ "$out" != /* ]]; then
  out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"
fi
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$(dirname "$out")" "$stage/gra-pit-calculator"
tar -C "$root" \
  --exclude .git \
  --exclude dist \
  --exclude build-zip.sh \
  -cf - . | tar -C "$stage/gra-pit-calculator" -xf -

rm -f "$out"
(
  cd "$stage"
  zip -r -X "$out" gra-pit-calculator
)

unzip -l "$out" | grep -q 'gra-pit-calculator/gra-pit-calculator.php'
unzip -l "$out" | grep -q 'gra-pit-calculator/includes/class-github-updater.php'
if unzip -l "$out" | grep -q '\.git/'; then
  echo "Refusing to pack a zip that contains .git" >&2
  exit 1
fi

echo "$out"
