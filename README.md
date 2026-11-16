# Cppify Lite — TinyBasic Interpreter

A simplified educational TinyBasic interpreter that runs directly in the browser using JavaScript. It does not require C++, Emscripten, WebAssembly, npm, or a build step.

## Features
- `let` variable declarations
- `print` output for strings, numbers, variables and expressions
- `input` statements with an in-page input box
- String literals with basic escape sequences (`\\n`, `\\t`, `\\\\`)
- Arithmetic: `+`, `-`, `*`, `/`, `%` (modulus), `^` or `**` (power), and parentheses
- Increment: `count++`, `++count`, or `increment count`
- Decrement: `count--`, `--count`, or `decrement count`
- Comments: `// comment` or `# comment` (full-line and end-of-line comments)
- Example programs, clear/reset, responsive dark IDE layout

## Arithmetic and update example
```basic
let a = 20;
let b = 6;

print a + b;  // Addition
print a - b;  // Subtraction
print a * b;  // Multiplication
print a / b;  // Division
print a % b;  // Modulus: remainder after division
print a ^ 2;  // Power: a raised to 2

let count = 3;
count++;       // Increment: count becomes 4
print count;
count--;       // Decrement: count becomes 3
print count;
```

## Run locally
1. Extract the ZIP file.
2. Open the extracted `CPPify_lite-main` folder.
3. Double-click `index.html` in Chrome, Edge, or Firefox.

Optional: serve the folder with VS Code Live Server or any static HTTP server.

## Deploy to Vercel
1. Upload the contents of this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework Preset: **Other**.
4. Build Command: leave empty.
5. Output Directory: `.` (or leave default for a static site).
6. Click **Deploy**.

## Notes
This is a small educational interpreter, not a full C++ compiler. It executes a deliberately limited TinyBasic language in the browser.
