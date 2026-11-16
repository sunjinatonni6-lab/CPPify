(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const source = $("source"), output = $("output"), inputForm = $("inputForm");
  let waitingResolve = null, currentRun = 0;

  const examples = {
    hello: 'print "Hello, World!";\nprint "Welcome to Cppify Lite";',
    input: 'print "What is your name?";\ninput name;\nprint "Hello, " + name + "!";',
    math: '// Arithmetic operators: +, -, *, /, %, and ^\nlet a = 20;\nlet b = 5;\nprint "Addition: " + (a + b); // Adds values\nprint "Subtraction: " + (a - b); // Subtracts values\nprint "Multiplication: " + (a * b); // Multiplies values\nprint "Division: " + (a / b); // Divides values\nprint "Modulus: " + (a % b); // Shows the remainder\nprint "Power: " + (a ^ 2); // Raises a to power 2\nlet count = 3;\ncount++; // Increment: adds 1\nprint "After increment: " + count;\ncount--; // Decrement: subtracts 1\nprint "After decrement: " + count;', 
    variables: 'let name = "Cppify";\nlet version = 1;\nprint "Project: " + name;\nprint "Version: " + version;'
  };

  function updateLines() {
    const count = Math.max(1, source.value.split("\n").length);
    $("lineNumbers").innerHTML = Array.from({length:count}, (_,i)=>i+1).join("<br>");
  }
  source.addEventListener("input", updateLines);
  source.addEventListener("scroll", () => $("lineNumbers").scrollTop = source.scrollTop);
  source.addEventListener("keydown", e => {
    if (e.key === "Tab") { e.preventDefault(); const a=source.selectionStart,b=source.selectionEnd; source.setRangeText("  ",a,b,"end"); updateLines(); }
    if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); runProgram(); }
  });
  $("examples").addEventListener("change", e => { if(examples[e.target.value]) {source.value=examples[e.target.value]; updateLines();} e.target.value=""; });
  $("clearBtn").onclick = () => { source.value=""; updateLines(); source.focus(); };
  $("resetBtn").onclick = () => { source.value=examples.hello; updateLines(); clearOutput(); };
  $("terminalClear").onclick = clearOutput;
  $("runBtn").onclick = runProgram;

  function clearOutput(){ output.innerHTML=""; $("runStatus").textContent="Ready"; hideInput(); }
  function printLine(value, kind="output-line") {
    const div=document.createElement("div"); div.className=kind; div.textContent=String(value); output.appendChild(div);
  }
  function showInput(variable) {
    inputForm.classList.remove("hidden");
    $("inputLabel").textContent=`Enter a value for "${variable}":`;
    $("runtimeInput").value=""; $("runtimeInput").focus();
  }
  function hideInput(){ inputForm.classList.add("hidden"); }
  inputForm.addEventListener("submit", e => {
    e.preventDefault(); if(!waitingResolve) return;
    const value=$("runtimeInput").value; hideInput();
    const resolve=waitingResolve; waitingResolve=null; resolve(value);
  });
  function requestInput(variable) {
    showInput(variable);
    return new Promise(resolve => { waitingResolve=resolve; });
  }

  class TinyBasicError extends Error {
    constructor(message,line){super(`Line ${line}: ${message}`);this.line=line;}
  }
  function tokenizeExpression(text,line) {
    const tokens=[]; let i=0;
    while(i<text.length){
      const c=text[i];
      if(/\s/.test(c)){i++;continue;}
      if(c==='"'||c==="'"){
        const quote=c; i++; let value="",closed=false;
        while(i<text.length){let ch=text[i++];if(ch===quote){closed=true;break;}if(ch==="\\"){if(i>=text.length)break;const esc=text[i++];value+=({"n":"\n","t":"\t","r":"\r","\\":"\\",'"':'"',"'":"'"}[esc]??esc);}else value+=ch;}
        if(!closed) throw new TinyBasicError("Unclosed string literal",line);
        tokens.push({type:"string",value});continue;
      }
      if(/[0-9]/.test(c)){
        let start=i++;while(i<text.length&&/[0-9.]/.test(text[i]))i++;
        const raw=text.slice(start,i);if((raw.match(/\./g)||[]).length>1)throw new TinyBasicError("Invalid number",line);
        tokens.push({type:"number",value:Number(raw)});continue;
      }
      if(/[A-Za-z_]/.test(c)){let start=i++;while(i<text.length&&/[A-Za-z0-9_]/.test(text[i]))i++;tokens.push({type:"identifier",value:text.slice(start,i)});continue;}
      const pair=text.slice(i,i+2);
      if(["++","--","**"].includes(pair)){tokens.push({type:pair,value:pair});i+=2;continue;}
      if("+-*/%^()".includes(c)){tokens.push({type:c,value:c});i++;continue;}
      throw new TinyBasicError(`Unexpected character "${c}"`,line);
    }
    return tokens;
  }
  function evaluateExpression(text, vars, line) {
    const ts=tokenizeExpression(text,line);let p=0;
    function primary(){
      const t=ts[p++];
      if(!t)throw new TinyBasicError("Expected a value",line);
      if(t.type==="number"||t.type==="string")return t.value;
      if(t.type==="identifier"){if(!vars.has(t.value))throw new TinyBasicError(`Variable "${t.value}" is not defined`,line);return vars.get(t.value);}
      if(t.type==="("){const v=additive();if(!ts[p]||ts[p].type!==")")throw new TinyBasicError('Expected ")"',line);p++;return v;}
      if(t.type==="-")return -Number(primary());
      if(t.type==="+")return Number(primary());
      throw new TinyBasicError("Invalid expression",line);
    }
    // Power operator: ^ or **. Exponentiation is right-associative.
    function power(){let v=primary();if(ts[p]&&(ts[p].type==="^"||ts[p].type==="**")){p++;v=Math.pow(Number(v),Number(power()));}return v;}
    // Multiplication, division, and modulus share the same precedence.
    function multiplicative(){let v=power();while(ts[p]&&["*","/","%"].includes(ts[p].type)){const op=ts[p++].type;const r=Number(power());if(op==="*")v=Number(v)*r;else if(op==="/")v=Number(v)/r;else v=Number(v)%r;}return v;}
    // Addition and subtraction have lower precedence.
    function additive(){let v=multiplicative();while(ts[p]&&(ts[p].type==="+"||ts[p].type==="-")){const op=ts[p++].type;const r=multiplicative();if(op==="+"&&(typeof v==="string"||typeof r==="string"))v=String(v)+String(r);else v=op==="+"?Number(v)+Number(r):Number(v)-Number(r);}return v;}
    if(!ts.length)throw new TinyBasicError("Missing expression",line);
    const value=additive();if(p<ts.length)throw new TinyBasicError("Unexpected token in expression",line);return value;
  }
  // Remove // and # comments, but keep these characters inside quoted strings.
  function stripComment(line) {
    let quote=null, escaped=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(quote){if(escaped){escaped=false;continue;}if(ch==="\\"){escaped=true;continue;}if(ch===quote)quote=null;continue;}
      if(ch==='"'||ch=="'")quote=ch;
      else if(ch==="#"||(ch==="/"&&line[i+1]==="/"))return line.slice(0,i);
    }
    return line;
  }
  function parseProgram(text) {
    const lines=text.split(/\r?\n/), statements=[];
    lines.forEach((raw,index)=>{
      const lineNo=index+1;let s=stripComment(raw).trim();if(!s)return;
      if(s.endsWith(";"))s=s.slice(0,-1).trim();
      let m;
      if((m=s.match(/^let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/))){statements.push({type:"let",name:m[1],expr:m[2],line:lineNo});}
      else if((m=s.match(/^print\s+(.+)$/))){statements.push({type:"print",expr:m[1],line:lineNo});}
      else if((m=s.match(/^input\s+([A-Za-z_][A-Za-z0-9_]*)$/))){statements.push({type:"input",name:m[1],line:lineNo});}
      // Supported forms: value++, ++value, value--, --value, increment value, decrement value.
      else if((m=s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+\+|--)$/))){statements.push({type:m[2]==="++"?"increment":"decrement",name:m[1],line:lineNo});}
      else if((m=s.match(/^(\+\+|--)([A-Za-z_][A-Za-z0-9_]*)$/))){statements.push({type:m[1]==="++"?"increment":"decrement",name:m[2],line:lineNo});}
      else if((m=s.match(/^(increment|decrement)\s+([A-Za-z_][A-Za-z0-9_]*)$/i))){statements.push({type:m[1].toLowerCase(),name:m[2],line:lineNo});}
      else throw new TinyBasicError("Unknown statement or invalid syntax",lineNo);
    });
    return {statements};
  }
  async function runProgram(){
    const runId=++currentRun;clearOutput();$("runStatus").textContent="Running";
    $("runBtn").disabled=true; printLine("▶ Starting TinyBasic Lite interpreter...","system");
    try{
      const program=parseProgram(source.value);const vars=new Map();
      for(const s of program.statements){
        if(runId!==currentRun)return;
        if(s.type==="let"){vars.set(s.name,evaluateExpression(s.expr,vars,s.line));}
        else if(s.type==="print"){printLine(evaluateExpression(s.expr,vars,s.line));}
        else if(s.type==="input"){const value=await requestInput(s.name);if(runId!==currentRun)return;vars.set(s.name,value);}
        else if(s.type==="increment"||s.type==="decrement"){
          if(!vars.has(s.name))throw new TinyBasicError(`Variable "${s.name}" is not defined`,s.line);
          const current=Number(vars.get(s.name));
          if(!Number.isFinite(current))throw new TinyBasicError(`Variable "${s.name}" must contain a number`,s.line);
          vars.set(s.name,current+(s.type==="increment"?1:-1));
        }
      }
      if(runId===currentRun){printLine("✓ Program finished successfully.","success");$("runStatus").textContent="Completed";}
    }catch(err){if(runId===currentRun){hideInput();printLine("✕ "+err.message,"error");$("runStatus").textContent="Error";}}
    finally{if(runId===currentRun)$("runBtn").disabled=false;}
  }
  updateLines();
})();