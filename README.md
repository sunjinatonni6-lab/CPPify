# Cppify Basic Compiler (No Python Standard Library Imports in Engine)

## Run locally
1. Install Python 3.10+.
2. Install the web server dependency: `pip install -r requirements.txt`
3. Open a terminal in this project folder.
4. Run: `python backend/app.py`
5. Visit: http://127.0.0.1:5000

## Important architecture note
`backend/compiler/engine.py` contains the custom tokenizer, recursive-descent expression parser, statement parser, and interpreter. It has **no import statements** and uses no Python Standard Library modules. The web wrapper uses Flask (an external package) to connect the browser UI to the Python engine. No Python Standard Library modules are imported by the project code.

## Supported language
- `let name = expression`
- `print expression`
- `input name`
- `name++`, `++name`, `name--`, `--name`
- `increment name`, `decrement name`
- integer and decimal numbers
- single- and double-quoted strings
- `+ - * / %`
- `^` and `**`
- parentheses and unary `+` / `-`
- `//` and `#` comments
- optional trailing semicolon

## Restrictions
No `eval()`, `exec()`, compiler packages, external compiler APIs, GCC, Clang, or LLVM are used by the engine. The engine limits source size, statement count, token count, and expression nesting. Because it does not import `time`, it does not enforce a wall-clock timeout.
