#!/usr/bin/env bash
# Generate files from templates using envsubst
# Usage: generate_from_templates.sh <source_dir> <output_dir>

set -e

SOURCE_DIR="${1:-/templates}"
OUTPUT_DIR="${2:-/output}"

cd "$SOURCE_DIR" || exit 1

for template in *.template.json; do
  [ -f "$template" ] || continue
  echo "Generating: ${template%.template.json}.json"
  envsubst < "$template" > "${OUTPUT_DIR}/${template%.template.json}.json"
done
