from backend.compiler.engine import run_program, TinyBasicError

assert run_program("print 10 + 5 * 2")["output"] == ["20"]
assert run_program("let x = 4\nx++\nprint x")["output"] == ["5"]
assert run_program("print -2 ^ 2\nprint 2 ** 3 ** 2")["output"] == ["-4", "512"]
assert run_program('print "hello" + " world"')["output"] == ["hello world"]
assert run_program('print "a // b" # comment')["output"] == ["a // b"]

try:
    run_program("print missing")
    raise AssertionError("Expected undefined-variable error")
except TinyBasicError:
    pass

print("6 tests passed")
