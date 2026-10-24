@echo off
where emcc >nul 2>nul
if errorlevel 1 (
  echo Emscripten emcc was not found. Install and activate the Emscripten SDK first.
  echo https://emscripten.org/docs/getting_started/downloads.html
  exit /b 1
)
emcc main.cpp -std=c++17 -O2 -Wall -Wextra -s MODULARIZE=1 -s EXPORT_NAME=createCppifyCompiler -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 --bind -o compiler.js
if errorlevel 1 exit /b 1
echo Build complete: compiler.js and compiler.wasm generated.
echo Commit both generated files before deploying the static site to Vercel.
