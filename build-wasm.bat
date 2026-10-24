@echo off
REM Run from an Emscripten command prompt.
emcc main.cpp -O2 -std=c++17 --bind -s MODULARIZE=1 -s EXPORT_NAME=createCppifyCompiler -s ENVIRONMENT=web -s ALLOW_MEMORY_GROWTH=1 -o compiler.js
if errorlevel 1 exit /b 1
echo Build complete: compiler.js and compiler.wasm generated.
echo Keep both generated files beside index.html.
