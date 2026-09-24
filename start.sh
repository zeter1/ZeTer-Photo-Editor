#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$(pwd)/index.html" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
  open "$(pwd)/index.html"
else
  printf '%s\n' "Open $(pwd)/index.html in a modern browser."
fi