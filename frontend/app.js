(() => {
  const codeEditor = document.getElementById('code');
  const output = document.getElementById('output');
  const runButton = document.getElementById('run');
  const clearButton = document.getElementById('clear');

  if (!codeEditor || !output || !runButton || !clearButton) {
    console.error('Cppify: required interface elements were not found.');
    return;
  }

  runButton.addEventListener('click', async () => {
    output.textContent = 'Running...';
    runButton.disabled = true;
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeEditor.value, inputs: [] })
      });
      const result = await response.json();
      if (result.status === 'completed') {
        output.textContent = Array.isArray(result.output) ? result.output.join('\n') : String(result.output ?? '');
      } else if (result.status === 'input_required') {
        output.textContent = `Input required: ${result.variable}`;
      } else {
        output.textContent = result.error || `Execution failed (HTTP ${response.status})`;
      }
    } catch (error) {
      console.error('Cppify run error:', error);
      output.textContent = 'Could not connect to the Python server. Check that http://127.0.0.1:5000 is running.';
    } finally {
      runButton.disabled = false;
    }
  });

  clearButton.addEventListener('click', () => {
    output.textContent = '';
  });
})();
