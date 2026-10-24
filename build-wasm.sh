#!/usr/bin/env bash
set -euo pipefail
# Install Emscripten and activate its environment before running this script.
emcc main.cpp -O2 -std=c++17 --bind \
  -s MODULARIZE=1 -s EXPORT_NAME=createCppifyCompiler \
  -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 \
  -o compiler.js
printf '\nBuild complete: compiler.js and compiler.wasm generated.\n'
printf 'The page loads compiler.js automatically when it is present beside index.html.\n'
