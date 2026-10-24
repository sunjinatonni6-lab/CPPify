#include <string>
#include <vector>
#include <regex>
#include <sstream>
#include <cctype>
#include <cstdio>
#include <emscripten/bind.h>

using namespace emscripten;

static std::string jsonEscape(const std::string& s) {
  std::string out;
  for (unsigned char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default: if (c < 0x20) { char buf[7]; std::snprintf(buf, sizeof(buf), "\\u%04x", c); out += buf; } else out += static_cast<char>(c);
    }
  }
  return out;
}
struct Token { std::string type, value; };
static void add(std::vector<Token>& v, const std::string& t, const std::string& x) { v.push_back({t,x}); }

std::string analyzeSource(const std::string& source) {
  std::vector<Token> tokens;
  std::smatch m;
  const std::regex coutPattern(R"REGEX((?:std::)?cout\s*<<\s*"((?:\\.|[^"\\])*)")REGEX");
  const std::regex mathPattern(R"(\b(add|sub|mult|div)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\))");
  if (std::regex_search(source, m, coutPattern)) {
    std::string val = m[1].str(), decoded;
    for (size_t i=0; i<val.size(); ++i) {
      if (val[i]=='\\' && i+1<val.size()) { char n=val[++i]; decoded += (n=='n' ? '\n' : n=='t' ? '\t' : n); }
      else decoded += val[i];
    }
    add(tokens,"NAMESPACE","std"); add(tokens,"OPERATOR","::"); add(tokens,"COMMAND","cout");
    add(tokens,"STREAM_OP","<<"); add(tokens,"STRING_LITERAL",decoded);
  } else if (std::regex_search(source, m, mathPattern)) {
    add(tokens,"COMMAND",m[1].str()); add(tokens,"ARG_INT",m[2].str()); add(tokens,"ARG_INT",m[3].str());
  } else {
    std::istringstream input(source); std::string part;
    while (input >> part) {
      bool number = !part.empty(); size_t start = (part[0]=='-' ? 1 : 0);
      if (start == part.size()) number = false;
      for (size_t i=start; i<part.size(); ++i) if (!std::isdigit(static_cast<unsigned char>(part[i]))) number=false;
      add(tokens, number ? "NUMBER_LITERAL" : "IDENTIFIER", part);
    }
  }
  std::ostringstream out; out << "[";
  for (size_t i=0; i<tokens.size(); ++i) {
    if (i) out << ",";
    out << "{\"type\":\"" << jsonEscape(tokens[i].type) << "\",\"value\":\"" << jsonEscape(tokens[i].value) << "\"}";
  }
  out << "]"; return out.str();
}
EMSCRIPTEN_BINDINGS(cppify_compiler) { function("analyzeSource", &analyzeSource); }
