// RAG Pipeline Dashboard - Javascript Logic

// Elements
const apiUrlInput = document.getElementById('api-url-input');
const apiReconnectBtn = document.getElementById('api-reconnect-btn');
const healthStatus = document.getElementById('health-status');
const healthStatusText = document.getElementById('health-status-text');

// Form element wrappers
const formTextWrapper = document.getElementById('form-text-wrapper');
const formFileWrapper = document.getElementById('form-file-wrapper');
const ingestSubmitBtn = document.getElementById('ingest-submit-btn');
const ingestBtnText = document.getElementById('ingest-btn-text');
const ingestLoader = document.getElementById('ingest-loader');

// Text inputs
const textContentInput = document.getElementById('text-content-input');
const chunkSizeInput = document.getElementById('chunk-size-input');
const chunkOverlapInput = document.getElementById('chunk-overlap-input');

// File inputs
const fileDropzone = document.getElementById('file-dropzone');
const fileInput = document.getElementById('file-input');
const selectedFileCard = document.getElementById('selected-file-card');
const fileNameDisplay = document.getElementById('file-name-display');
const fileSizeDisplay = document.getElementById('file-size-display');
const clearFileBtn = document.getElementById('clear-file-btn');

// Query inputs
const queryInput = document.getElementById('query-input');
const ragModeSelect = document.getElementById('rag-mode-select');
const queryParametersSection = document.getElementById('query-parameters-section');
const topKInput = document.getElementById('top-k-input');
const querySubmitBtn = document.getElementById('query-submit-btn');
const queryLoader = document.getElementById('query-loader');

// Console & Results
const terminalScreen = document.getElementById('terminal-screen');
const clearConsoleBtn = document.getElementById('clear-console-btn');
const resetDbBtn = document.getElementById('reset-db-btn');
const resultsWrapper = document.getElementById('results-wrapper');
const agentAnswerContainer = document.getElementById('agent-answer-container');
const agentAnswerText = document.getElementById('agent-answer-text');
const resultsSectionTitle = document.getElementById('results-section-title');
const resultsGrid = document.getElementById('results-grid');

// State Variables
let currentTab = 'ingest';
let currentIngestMode = 'text';
let selectedFile = null;
let healthCheckInterval = null;
let resetConfirmationTimeout = null;
let resetConfirmState = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkBackendHealth();
  
  // Set up health polling
  healthCheckInterval = setInterval(checkBackendHealth, 15000);
});

// Setup Event Listeners
function setupEventListeners() {
  // Reconnect check
  apiReconnectBtn.addEventListener('click', () => {
    appendLog('info', `Pinging backend at: ${apiUrlInput.value}/health ...`);
    checkBackendHealth();
  });

  // API base URL input change
  apiUrlInput.addEventListener('change', () => {
    appendLog('info', `API endpoint updated to: ${apiUrlInput.value}`);
    checkBackendHealth();
  });

  // Submit Ingestion
  ingestSubmitBtn.addEventListener('click', handleIngestion);

  // Submit Query
  querySubmitBtn.addEventListener('click', handleQuery);

  // RAG Mode dropdown change handler
  if (ragModeSelect) {
    ragModeSelect.addEventListener('change', () => {
      const mode = ragModeSelect.value;
      appendLog('muted', `> RAG retrieval mode switched to: [${mode.toUpperCase()}]`);
      if (mode === 'agentic') {
        queryParametersSection.classList.add('hidden');
      } else {
        queryParametersSection.classList.remove('hidden');
      }
    });
  }

  // Clear terminal
  clearConsoleBtn.addEventListener('click', () => {
    terminalScreen.innerHTML = '';
    appendLog('muted', '--- Console logs cleared ---');
  });

  // Reset database (Danger Zone)
  if (resetDbBtn) {
    resetDbBtn.addEventListener('click', handleResetCollection);
  }

  // Dropzone drag-and-drop actions
  fileDropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelection);

  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.remove('dragover');
    }, false);
  });

  fileDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      fileInput.files = files;
      handleFileSelection();
    }
  }, false);

  clearFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileSelection();
  });
}

// ----------------------------------------------------
// Health Check Logic
// ----------------------------------------------------
async function checkBackendHealth() {
  const baseUrl = apiUrlInput.value.replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      healthStatus.className = 'health-status-badge online';
      healthStatusText.textContent = 'ONLINE';
      
      // Log connection check on manual trigger/first load
      if (document.activeElement === apiReconnectBtn || !healthCheckInterval) {
        appendLog('success', `[sys] Connection healthy. Vector db status: ${JSON.stringify(data.vector_store || 'connected')}`);
      }
    } else {
      setOffline();
    }
  } catch (error) {
    setOffline();
  }
}

function setOffline() {
  healthStatus.className = 'health-status-badge offline';
  healthStatusText.textContent = 'OFFLINE';
}

// ----------------------------------------------------
// UI Tab & Mode Switches
// ----------------------------------------------------
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-ingest-btn').classList.toggle('active', tab === 'ingest');
  document.getElementById('tab-query-btn').classList.toggle('active', tab === 'query');

  document.getElementById('tab-ingest').classList.toggle('active', tab === 'ingest');
  document.getElementById('tab-query').classList.toggle('active', tab === 'query');

  appendLog('muted', `> Switched panel view to: [${tab.toUpperCase()}]`);

  // Show results view only when tab is query and results exist
  if (tab === 'query' && (resultsGrid.children.length > 0 || (agentAnswerContainer && !agentAnswerContainer.classList.contains('hidden')))) {
    resultsWrapper.classList.remove('hidden');
  } else {
    resultsWrapper.classList.add('hidden');
  }
}

function switchIngestMode(mode) {
  currentIngestMode = mode;
  document.getElementById('mode-text-btn').classList.toggle('active', mode === 'text');
  document.getElementById('mode-file-btn').classList.toggle('active', mode === 'file');

  formTextWrapper.classList.toggle('hidden', mode !== 'text');
  formFileWrapper.classList.toggle('hidden', mode !== 'file');

  appendLog('muted', `> Ingestion mode changed to: [${mode.toUpperCase()}]`);
}

// ----------------------------------------------------
// Metadata Editor Helpers
// ----------------------------------------------------
function addMetadataRow(formType) {
  const gridId = formType === 'text' ? 'text-metadata-grid' : 'file-metadata-grid';
  const grid = document.getElementById(gridId);

  const row = document.createElement('div');
  row.className = 'meta-row';
  row.innerHTML = `
    <input type="text" placeholder="Key" class="meta-key">
    <input type="text" placeholder="Value" class="meta-value">
    <button class="remove-meta-btn" onclick="removeMetadataRow(this)">&times;</button>
  `;
  grid.appendChild(row);
}

function removeMetadataRow(btn) {
  const row = btn.parentElement;
  row.remove();
}

function getMetadata(formType) {
  const gridId = formType === 'text' ? 'text-metadata-grid' : 'file-metadata-grid';
  const grid = document.getElementById(gridId);
  const rows = grid.querySelectorAll('.meta-row');
  
  const metadata = {};
  rows.forEach(row => {
    const key = row.querySelector('.meta-key').value.trim();
    const val = row.querySelector('.meta-value').value.trim();
    if (key) {
      metadata[key] = val;
    }
  });
  return metadata;
}

// ----------------------------------------------------
// File Upload Selection Handlers
// ----------------------------------------------------
function handleFileSelection() {
  const file = fileInput.files[0];
  if (!file) return;

  const validTypes = ['.txt', '.pdf'];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  
  if (!validTypes.includes(ext)) {
    appendLog('error', `[validation_err] Unsupported file type '${ext}'. Please upload a .txt or .pdf file.`);
    resetFileSelection();
    return;
  }

  selectedFile = file;
  fileNameDisplay.textContent = file.name;
  fileSizeDisplay.textContent = formatBytes(file.size);
  
  selectedFileCard.classList.remove('hidden');
  fileDropzone.classList.add('hidden');
  
  appendLog('info', `Selected file: ${file.name} (${formatBytes(file.size)})`);
}

function resetFileSelection() {
  selectedFile = null;
  fileInput.value = '';
  selectedFileCard.classList.add('hidden');
  fileDropzone.classList.remove('hidden');
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ----------------------------------------------------
// Ingestion Action Trigger
// ----------------------------------------------------
async function handleIngestion() {
  const baseUrl = apiUrlInput.value.replace(/\/$/, "");
  const chunkSize = parseInt(chunkSizeInput.value, 10);
  const chunkOverlap = parseInt(chunkOverlapInput.value, 10);

  // Validate parameters
  if (chunkSize < 50 || chunkSize > 5000) {
    appendLog('error', '[validation_err] CHUNK_SIZE must be between 50 and 5000.');
    return;
  }
  if (chunkOverlap < 0 || chunkOverlap > 1000) {
    appendLog('error', '[validation_err] CHUNK_OVERLAP must be between 0 and 1000.');
    return;
  }

  setIngestLoading(true);

  if (currentIngestMode === 'text') {
    const textContent = textContentInput.value.trim();
    if (!textContent) {
      appendLog('error', '[validation_err] Document text content cannot be empty.');
      setIngestLoading(false);
      return;
    }

    const metadata = getMetadata('text');
    const payload = {
      documents: [
        {
          text: textContent,
          metadata: metadata
        }
      ],
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap
    };

    appendLog('primary', `\n>>> POST ${baseUrl}/documents`);
    appendLog('muted', `Payload: ${highlightJSON(payload)}`);

    try {
      const response = await fetch(`${baseUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      
      if (response.ok) {
        appendLog('success', `<<< [${response.status}] Document Ingested Successfully!`);
        appendLog('success', highlightJSON(resData));
        // Clear text field upon success
        textContentInput.value = '';
      } else {
        appendLog('error', `<<< [${response.status}] Ingestion Failed:`);
        appendLog('error', highlightJSON(resData));
      }
    } catch (err) {
      appendLog('error', `<<< Connection Failed: ${err.message}`);
    }

  } else {
    // File upload mode
    if (!selectedFile) {
      appendLog('error', '[validation_err] Please upload or drop a file first.');
      setIngestLoading(false);
      return;
    }

    const metadata = getMetadata('file');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('chunk_size', chunkSize);
    formData.append('chunk_overlap', chunkOverlap);
    formData.append('metadata', JSON.stringify(metadata));

    appendLog('primary', `\n>>> POST ${baseUrl}/documents/upload`);
    appendLog('muted', `Multipart/Form data: file=${selectedFile.name}, chunk_size=${chunkSize}, chunk_overlap=${chunkOverlap}`);
    appendLog('muted', `Metadata payload: ${JSON.stringify(metadata)}`);

    try {
      const response = await fetch(`${baseUrl}/documents/upload`, {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();

      if (response.ok) {
        appendLog('success', `<<< [${response.status}] File '${selectedFile.name}' Ingested Successfully!`);
        appendLog('success', highlightJSON(resData));
        resetFileSelection();
      } else {
        appendLog('error', `<<< [${response.status}] File Ingestion Failed:`);
        appendLog('error', highlightJSON(resData));
      }
    } catch (err) {
      appendLog('error', `<<< Connection Failed: ${err.message}`);
    }
  }

  setIngestLoading(false);
  checkBackendHealth();
}

function setIngestLoading(loading) {
  if (loading) {
    ingestSubmitBtn.disabled = true;
    ingestLoader.classList.remove('hidden');
    ingestBtnText.textContent = 'INGESTING...';
  } else {
    ingestSubmitBtn.disabled = false;
    ingestLoader.classList.add('hidden');
    ingestBtnText.textContent = 'INGEST TO VECTOR STORE';
  }
}

// ----------------------------------------------------
// Context Querying Logic
// ----------------------------------------------------
async function handleQuery() {
  const baseUrl = apiUrlInput.value.replace(/\/$/, "");
  const queryText = queryInput.value.trim();
  const isAgentic = ragModeSelect && ragModeSelect.value === 'agentic';

  if (!queryText) {
    appendLog('error', '[validation_err] Search query cannot be empty.');
    return;
  }

  setQueryLoading(true);
  resultsWrapper.classList.add('hidden');
  resultsGrid.innerHTML = '';
  if (agentAnswerContainer) {
    agentAnswerContainer.classList.add('hidden');
    agentAnswerText.textContent = '';
  }

  if (isAgentic) {
    // Agentic RAG
    const payload = {
      prompt: queryText
    };

    appendLog('primary', `\n>>> POST ${baseUrl}/agent/chat`);
    appendLog('muted', `Payload: ${highlightJSON(payload)}`);

    try {
      const response = await fetch(`${baseUrl}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (response.ok) {
        appendLog('success', `<<< [${response.status}] Agent Chat Success!`);
        appendLog('success', highlightJSON(resData));

        // Log agent reasoning trace (tool calls) to terminal
        if (resData.tool_calls && resData.tool_calls.length > 0) {
          appendLog('info', `[agent_reasoning] The agent executed ${resData.tool_calls.length} tool call(s) during reasoning:`);
          resData.tool_calls.forEach((call, index) => {
            appendLog('info', `  ↳ Tool Call #${index + 1}: query_knowledge_base(query="${call.query}", top_k=${call.top_k})`);
            appendLog('muted', `    Results count: ${call.results_count}`);
          });
        } else {
          appendLog('muted', `[agent_reasoning] The agent answered directly without calling any tools.`);
        }

        // Show Agent's generated answer
        if (resData.answer && agentAnswerContainer && agentAnswerText) {
          agentAnswerText.textContent = resData.answer;
          agentAnswerContainer.classList.remove('hidden');
        }

        // Render sources if any
        if (resultsSectionTitle) {
          resultsSectionTitle.innerHTML = `<span class="success-color">&gt;</span> AGENT_RETRIEVED_SOURCES`;
        }
        
        if (resData.sources && resData.sources.length > 0) {
          renderQueryResults(resData.sources);
        } else {
          resultsGrid.innerHTML = `<div class="result-card" style="text-align: center; color: var(--text-muted);">No source context chunks were retrieved by the agent.</div>`;
          if (currentTab === 'query') {
            resultsWrapper.classList.remove('hidden');
          }
        }
      } else {
        appendLog('error', `<<< [${response.status}] Agent Chat Failed:`);
        appendLog('error', highlightJSON(resData));
      }
    } catch (err) {
      appendLog('error', `<<< Connection Failed: ${err.message}`);
    }
  } else {
    // Classic RAG
    const topK = parseInt(topKInput.value, 10);
    const payload = {
      query: queryText,
      top_k: topK
    };

    appendLog('primary', `\n>>> POST ${baseUrl}/retrieve`);
    appendLog('muted', `Payload: ${highlightJSON(payload)}`);

    try {
      const response = await fetch(`${baseUrl}/retrieve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (response.ok) {
        appendLog('success', `<<< [${response.status}] Retrieval Success!`);
        appendLog('success', highlightJSON(resData));

        if (resultsSectionTitle) {
          resultsSectionTitle.innerHTML = `<span class="success-color">&gt;</span> RETRIEVED_CONTEXT_CHUNKS`;
        }

        if (resData.results && resData.results.length > 0) {
          renderQueryResults(resData.results);
        } else {
          appendLog('warning', 'No relevant document matches found for this query.');
          resultsGrid.innerHTML = `<div class="result-card" style="text-align: center; color: var(--text-muted);">No matching document chunks found in database.</div>`;
          resultsWrapper.classList.remove('hidden');
        }
      } else {
        appendLog('error', `<<< [${response.status}] Query Search Failed:`);
        appendLog('error', highlightJSON(resData));
      }
    } catch (err) {
      appendLog('error', `<<< Connection Failed: ${err.message}`);
    }
  }

  setQueryLoading(false);
  checkBackendHealth();
}

function setQueryLoading(loading) {
  if (loading) {
    querySubmitBtn.disabled = true;
    queryLoader.classList.remove('hidden');
  } else {
    querySubmitBtn.disabled = false;
    queryLoader.classList.add('hidden');
  }
}

function renderQueryResults(results) {
  resultsGrid.innerHTML = '';
  
  results.forEach((res, idx) => {
    const card = document.createElement('article');
    card.className = 'result-card';
    
    // Format metadata badges
    let metadataHtml = '';
    if (res.metadata && Object.keys(res.metadata).length > 0) {
      metadataHtml = Object.entries(res.metadata)
        .map(([k, v]) => `<span class="meta-badge"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</span>`)
        .join(' ');
    } else {
      metadataHtml = '<span class="meta-badge italic">none</span>';
    }

    const percentage = Math.round(res.score * 100);

    card.innerHTML = `
      <div class="result-header">
        <span class="result-index">MATCH_CHUNK_#${idx + 1}</span>
        <div class="score-badge">
          <span class="score-text">SCORE: ${(res.score).toFixed(4)}</span>
          <div class="score-bar-bg">
            <div class="score-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      </div>
      <p class="result-text">${escapeHtml(res.text)}</p>
      <div class="result-metadata-container">
        <span class="metadata-label">METADATA:</span>
        ${metadataHtml}
      </div>
    `;
    
    resultsGrid.appendChild(card);
  });

  if (currentTab === 'query') {
    resultsWrapper.classList.remove('hidden');
    // Scroll to results cleanly
    resultsWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ----------------------------------------------------
// Vector Store Reset Logic (Double-Confirmation style)
// ----------------------------------------------------
async function handleResetCollection() {
  const baseUrl = apiUrlInput.value.replace(/\/$/, "");

  if (!resetConfirmState) {
    // First click: warn user and change state
    resetConfirmState = true;
    resetDbBtn.textContent = 'CONFIRM_RESET?';
    resetDbBtn.style.borderColor = 'var(--accent-red)';
    resetDbBtn.style.color = 'var(--accent-red)';
    
    appendLog('warning', '\n[sys_warn] WARNING: RESET_DB button clicked. Click RESET_DB again within 4 seconds to drop collection and wipe all stored vector embeddings.');
    
    // Auto timeout after 4 seconds
    resetConfirmationTimeout = setTimeout(() => {
      resetConfirmState = false;
      resetDbBtn.textContent = 'RESET_DB';
      resetDbBtn.style.borderColor = '';
      resetDbBtn.style.color = '';
      appendLog('muted', '[sys] Reset DB confirmation timed out. Action canceled.');
    }, 4000);
    return;
  }

  // Second click: proceed with DELETE
  clearTimeout(resetConfirmationTimeout);
  resetConfirmState = false;
  
  resetDbBtn.textContent = 'RESETTING...';
  resetDbBtn.disabled = true;
  resetDbBtn.style.borderColor = '';
  resetDbBtn.style.color = '';

  appendLog('primary', `\n>>> DELETE ${baseUrl}/documents`);

  try {
    const response = await fetch(`${baseUrl}/documents`, {
      method: 'DELETE'
    });

    const resData = await response.json();

    if (response.ok) {
      appendLog('success', `<<< [${response.status}] Vector database collection successfully reset!`);
      appendLog('success', highlightJSON(resData));
      
      // Wipe any existing query results in the dashboard UI
      resultsGrid.innerHTML = '';
      if (agentAnswerContainer) {
        agentAnswerContainer.classList.add('hidden');
        agentAnswerText.textContent = '';
      }
      resultsWrapper.classList.add('hidden');
    } else {
      appendLog('error', `<<< [${response.status}] Reset Collection Failed:`);
      appendLog('error', highlightJSON(resData));
    }
  } catch (err) {
    appendLog('error', `<<< Connection Failed: ${err.message}`);
  }

  resetDbBtn.disabled = false;
  resetDbBtn.textContent = 'RESET_DB';
  checkBackendHealth();
}



// ----------------------------------------------------
// System Log Console Screen Rendering
// ----------------------------------------------------
function appendLog(type, text) {
  const logLine = document.createElement('div');
  
  let colorClass = 'primary-color';
  if (type === 'success') colorClass = 'success-color';
  else if (type === 'warning') colorClass = 'warning-color';
  else if (type === 'error') colorClass = 'error-color';
  else if (type === 'muted') colorClass = 'muted-color';
  else if (type === 'info') colorClass = 'info-color';

  logLine.className = `term-line ${colorClass}`;
  
  // Format prefix
  const timestamp = new Date().toLocaleTimeString();
  logLine.innerHTML = `<span class="muted-color">[${timestamp}]</span> ${text}`;
  
  terminalScreen.appendChild(logLine);
  
  // Auto scroll
  terminalScreen.scrollTop = terminalScreen.scrollHeight;
}

// JSON syntax highlighter
function highlightJSON(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }
  // Escape html characters to prevent script injections in debug log
  json = escapeHtml(json);
  
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'json-val-num';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-val-str';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-val-bool';
    } else if (/null/.test(match)) {
      cls = 'json-val-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Expose handlers globally for HTML onclick attributes
window.switchTab = switchTab;
window.switchIngestMode = switchIngestMode;
window.addMetadataRow = addMetadataRow;
window.removeMetadataRow = removeMetadataRow;
