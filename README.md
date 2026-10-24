# Cppify - WebAssembly C++ Compiler Studio

A browser-based educational compiler UI. The existing UI is retained. The source analyzer can now run from C++ compiled to WebAssembly using Emscripten; the browser-side JavaScript continues to manage UI, build the demonstration target Wasm module, run it, and render output.

## Files
- `index.html` — page structure and UI
- `styles.css` — custom CSS styles
- `app.js` — UI behavior, bridge to the C++ analyzer, demo Wasm generation/execution and export
- `main.cpp` — C++ source analyzer exposed to JavaScript through Embind
- `build-wasm.sh` / `build-wasm.bat` — Emscripten build commands
- `tailwind.config.js` — Tailwind theme extension

## Build the C++ WebAssembly analyzer
1. Install the Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html
2. Activate the Emscripten environment (`emsdk_env.bat` on Windows or `source ./emsdk_env.sh` on macOS/Linux).
3. Run `build-wasm.bat` in an Emscripten Command Prompt on Windows, or `./build-wasm.sh` on macOS/Linux.
4. The build creates `compiler.js` and `compiler.wasm`. Keep both beside `index.html`.
5. Serve the folder using a local web server (recommended), for example `python -m http.server 8000`, then open `http://localhost:8000`.

The page automatically uses the C++ analyzer when `compiler.js` is present. If you have not built the module yet, the original JavaScript analyzer remains as a fallback, so the interface still opens.

## Important scope note
This is still an educational demo, not a complete C++ compiler. The C++ analyzer recognizes the supported `std::cout << "..."` pattern and `add`, `sub`, `mult`, `div` integer calls. JavaScript currently generates the small target WebAssembly module from those recognized tokens and executes it. Arbitrary C++ source, the full C++ standard library, and general compiler features are not supported.
