# Cppify Basic Compiler Engine
# No Python imports and no Python Standard Library modules are used here.
# The tokenizer, parser, and interpreter are implemented from scratch.

class TinyBasicError(Exception):
    def __init__(self, message, line=None):
        self.line = line
        if line is not None:
            message = "Line " + str(line) + ": " + str(message)
        super().__init__(message)


class InputRequired(Exception):
    def __init__(self, variable, output):
        self.variable = variable
        self.output = output
        super().__init__("Input required for " + variable)


class Token:
    def __init__(self, kind, value, position):
        self.kind = kind
        self.value = value
        self.position = position


def is_digit(ch):
    return "0" <= ch <= "9"


def is_letter(ch):
    return ("a" <= ch <= "z") or ("A" <= ch <= "Z") or ch == "_"


def is_name_char(ch):
    return is_letter(ch) or is_digit(ch)


def tokenize(source, line):
    tokens = []
    i = 0
    length = len(source)

    while i < length:
        ch = source[i]

        if ch in " \t\r\n":
            i += 1
            continue

        start = i

        # Numeric literal: integer or decimal.
        if is_digit(ch) or (ch == "." and i + 1 < length and is_digit(source[i + 1])):
            has_dot = False
            if ch == ".":
                has_dot = True
                i += 1
            while i < length and is_digit(source[i]):
                i += 1
            if i < length and source[i] == "." and not has_dot:
                has_dot = True
                i += 1
                while i < length and is_digit(source[i]):
                    i += 1
            raw = source[start:i]
            value = float(raw) if has_dot else int(raw)
            tokens.append(Token("NUMBER", value, start))
            continue

        # Identifier.
        if is_letter(ch):
            i += 1
            while i < length and is_name_char(source[i]):
                i += 1
            tokens.append(Token("IDENT", source[start:i], start))
            continue

        # Quoted string with basic escape handling.
        if ch == '"' or ch == "'":
            quote = ch
            i += 1
            chars = []
            closed = False
            while i < length:
                current = source[i]
                if current == quote:
                    i += 1
                    closed = True
                    break
                if current == "\\":
                    i += 1
                    if i >= length:
                        raise TinyBasicError("Unterminated string escape", line)
                    escaped = source[i]
                    mapping = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\",
                               "'": "'", '"': '"'}
                    chars.append(mapping.get(escaped, escaped))
                    i += 1
                else:
                    chars.append(current)
                    i += 1
            if not closed:
                raise TinyBasicError("Unterminated string", line)
            tokens.append(Token("STRING", "".join(chars), start))
            continue

        # Power operators.
        if source.startswith("**", i):
            tokens.append(Token("POWER", "**", i))
            i += 2
            continue
        if ch == "^":
            tokens.append(Token("POWER", "^", i))
            i += 1
            continue

        # Increment/decrement operators are handled as statements, not expressions.
        if source.startswith("++", i) or source.startswith("--", i):
            op = source[i:i + 2]
            tokens.append(Token("INCDEC", op, i))
            i += 2
            continue

        if ch in "+-*/%()":
            tokens.append(Token(ch, ch, i))
            i += 1
            continue

        raise TinyBasicError("Unexpected character " + repr(ch), line)

    if len(tokens) > 1000:
        raise TinyBasicError("Expression is too long (maximum 1000 tokens)", line)
    return tokens


class ExpressionParser:
    def __init__(self, source, variables, line):
        self.tokens = tokenize(source, line)
        self.variables = variables
        self.line = line
        self.pos = 0
        self.depth = 0

    def peek(self):
        if self.pos >= len(self.tokens):
            return None
        return self.tokens[self.pos].kind

    def take(self):
        if self.pos >= len(self.tokens):
            raise TinyBasicError("Unexpected end of expression", self.line)
        token = self.tokens[self.pos]
        self.pos += 1
        return token

    def parse(self):
        if not self.tokens:
            raise TinyBasicError("Missing expression", self.line)
        value = self.additive()
        if self.peek() is not None:
            raise TinyBasicError("Unexpected token after expression", self.line)
        return value

    def additive(self):
        value = self.multiplicative()
        while self.peek() in ("+", "-"):
            op = self.take().kind
            right = self.multiplicative()
            if op == "+" and isinstance(value, str) and isinstance(right, str):
                value = value + right
            else:
                a = self.number(value)
                b = self.number(right)
                value = a + b if op == "+" else a - b
            self.check_finite(value)
        return value

    def multiplicative(self):
        value = self.unary()
        while self.peek() in ("*", "/", "%"):
            op = self.take().kind
            right = self.unary()
            a = self.number(value)
            b = self.number(right)
            if op in ("/", "%") and b == 0:
                raise TinyBasicError("Division by zero", self.line)
            if op == "*":
                value = a * b
            elif op == "/":
                value = a / b
            else:
                value = a % b
            self.check_finite(value)
        return value

    def unary(self):
        if self.peek() == "+":
            self.take()
            return self.number(self.unary())
        if self.peek() == "-":
            self.take()
            return -self.number(self.unary())
        return self.power()

    def power(self):
        value = self.primary()
        if self.peek() == "POWER":
            self.take()
            exponent = self.unary()
            try:
                value = self.number(value) ** self.number(exponent)
            except (OverflowError, ZeroDivisionError):
                raise TinyBasicError("Invalid power operation", self.line)
            self.check_finite(value)
        return value

    def primary(self):
        token = self.take()
        if token.kind == "NUMBER" or token.kind == "STRING":
            return token.value

        if token.kind == "IDENT":
            name = token.value
            if name not in self.variables:
                raise TinyBasicError("Variable '" + name + "' is not defined", self.line)
            return self.variables[name]

        if token.kind == "(":
            self.depth += 1
            if self.depth > 100:
                raise TinyBasicError("Expression nesting is too deep", self.line)
            value = self.additive()
            if self.peek() != ")":
                raise TinyBasicError("Missing closing parenthesis", self.line)
            self.take()
            self.depth -= 1
            return value

        raise TinyBasicError("Expected a number, string, variable, or '('", self.line)

    def number(self, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TinyBasicError("A numeric value is required", self.line)
        return value

    def check_finite(self, value):
        if isinstance(value, float):
            if value != value or value == float("inf") or value == -float("inf"):
                raise TinyBasicError("Numeric result is out of range", self.line)


def strip_comment(line):
    quote = None
    escaped = False
    i = 0
    while i < len(line):
        ch = line[i]
        if quote is not None:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch == '"' or ch == "'":
            quote = ch
            i += 1
            continue
        if ch == "#" or line.startswith("//", i):
            return line[:i]
        i += 1
    return line


def valid_name(name):
    if not name or not is_letter(name[0]):
        return False
    for ch in name[1:]:
        if not is_name_char(ch):
            return False
    return True


def parse_program(source):
    statements = []
    if len(source) > 100000:
        raise TinyBasicError("Program is too large (maximum 100 KB)")

    for line_number, raw_line in enumerate(source.splitlines(), 1):
        statement = strip_comment(raw_line).strip()
        if not statement:
            continue
        if statement.endswith(";"):
            statement = statement[:-1].rstrip()
        if not statement:
            continue

        # let name = expression
        if statement.startswith("let "):
            rest = statement[4:].strip()
            equal = rest.find("=")
            if equal < 0:
                raise TinyBasicError("Expected '=' in variable declaration", line_number)
            name = rest[:equal].strip()
            expression = rest[equal + 1:].strip()
            if not valid_name(name):
                raise TinyBasicError("Invalid variable name", line_number)
            if not expression:
                raise TinyBasicError("Missing expression", line_number)
            statements.append(("let", name, expression, line_number))

        elif statement.startswith("print "):
            expression = statement[6:].strip()
            if not expression:
                raise TinyBasicError("Missing print expression", line_number)
            statements.append(("print", None, expression, line_number))

        elif statement.startswith("input "):
            name = statement[6:].strip()
            if not valid_name(name):
                raise TinyBasicError("Invalid input variable name", line_number)
            statements.append(("input", name, None, line_number))

        elif statement.startswith("increment "):
            name = statement[10:].strip()
            if not valid_name(name):
                raise TinyBasicError("Invalid variable name", line_number)
            statements.append(("increment", name, None, line_number))

        elif statement.startswith("decrement "):
            name = statement[10:].strip()
            if not valid_name(name):
                raise TinyBasicError("Invalid variable name", line_number)
            statements.append(("decrement", name, None, line_number))

        else:
            # Prefix or postfix ++ / --
            if statement.startswith("++") or statement.startswith("--"):
                op, name = statement[:2], statement[2:].strip()
            elif statement.endswith("++") or statement.endswith("--"):
                op, name = statement[-2:], statement[:-2].strip()
            else:
                raise TinyBasicError("Unknown statement", line_number)

            if not valid_name(name):
                raise TinyBasicError("Invalid variable name", line_number)
            statements.append(("increment" if op == "++" else "decrement",
                               name, None, line_number))

        if len(statements) > 10000:
            raise TinyBasicError("Program has too many statements (maximum 10000)")
    return statements


def display_value(value):
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value)


def run_program(source, inputs=None, timeout_seconds=2.0):
    # timeout_seconds is retained for API compatibility. This engine uses
    # bounded source, token, nesting, and statement counts instead of time imports.
    if not isinstance(source, str):
        raise TinyBasicError("Source code must be text")

    if inputs is None:
        inputs = []
    if not isinstance(inputs, list):
        inputs = [inputs]

    statements = parse_program(source)
    variables = {}
    output = []
    input_index = 0

    for kind, name, expression, line in statements:
        if kind == "let":
            variables[name] = ExpressionParser(expression, variables, line).parse()

        elif kind == "print":
            value = ExpressionParser(expression, variables, line).parse()
            output.append(display_value(value))

        elif kind == "input":
            if input_index >= len(inputs):
                raise InputRequired(name, output)
            variables[name] = str(inputs[input_index])
            input_index += 1

        elif kind == "increment" or kind == "decrement":
            if name not in variables:
                raise TinyBasicError("Variable '" + name + "' is not defined", line)
            current = variables[name]
            if isinstance(current, bool) or not isinstance(current, (int, float)):
                raise TinyBasicError("Increment/decrement requires a number", line)
            variables[name] = current + (1 if kind == "increment" else -1)

    return {"status": "completed", "output": output, "error": None}
