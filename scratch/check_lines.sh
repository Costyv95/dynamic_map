#!/bin/bash
# Fail when any source/test file exceeds 300 lines (Costi's rule).
cd "$(dirname "$0")/.." || exit 1
bad=$(find custom_components server tests -type f \( -name '*.js' -o -name '*.py' -o -name '*.css' -o -name '*.html' \) \
    -not -path '*/node_modules/*' -not -name 'polybool.min.js' -print0 | xargs -0 wc -l | awk '$1 > 300 && $2 != "total" {print}')
if [ -n "$bad" ]; then echo "Files over 300 lines:"; echo "$bad"; exit 1; fi
echo "All files within 300 lines."
