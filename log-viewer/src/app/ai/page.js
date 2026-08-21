'use client';

import { useState, useEffect } from 'react';

export default function AILogViewer() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [model, setModel] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [page, model]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page, limit: 50 });
      if (model) query.append('model', model);

      const res = await fetch(`/api/ai-logs?${query.toString()}`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <>
      <main className="main-content">
        <div className="header-section">
          <h1>AI Usage & Telemetry</h1>
          <p>Detailed tracking of token consumption, prompts, and latency across AI models.</p>
        </div>

        {/* Filters */}
        <div className="filters-card" style={{ display: 'flex', gap: '1rem', width: 'fit-content' }}>
          <select 
            className="select-filter"
            value={model}
            onChange={(e) => { setModel(e.target.value); setPage(1); }}
          >
            <option value="">All Models</option>
            <option value="openai/gpt-oss-120b">openai/gpt-oss-120b</option>
            <option value="llama-3-8b-8192">llama-3-8b-8192</option>
            <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
          </select>
          <button className="btn-view" onClick={fetchLogs}>Refresh</button>
        </div>

        {/* Data Table */}
        <div className="table-card">
          {loading && logs.length === 0 ? (
            <div className="loading-state">Loading AI logs...</div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Model</th>
                  <th>Total Tokens</th>
                  <th>Prompt Tokens</th>
                  <th>Comp Tokens</th>
                  <th>Latency</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} onClick={() => setSelectedLog(log)} className="log-row">
                    <td className="time-cell">{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <span className="badge-status status-success" style={{ textTransform: 'none', background: '#e0e7ff', color: '#3730a3' }}>
                        {log.model}
                      </span>
                    </td>
                    <td><strong style={{ color: 'var(--primary)' }}>{log.total_tokens}</strong></td>
                    <td>{log.prompt_tokens}</td>
                    <td>{log.completion_tokens}</td>
                    <td className="ms-cell">{log.latency_ms}ms</td>
                    <td>
                      <button className="btn-view">View Payloads</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          <div className="pagination">
            <span>Showing page {page} ({total} total logs)</span>
            <div className="pagination-controls">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <button disabled={logs.length < 50} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      </main>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" style={{ maxWidth: '1000px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>AI Telemetry Details</h2>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div className="detail-item">
                  <label>Model</label>
                  <div><strong>{selectedLog.model}</strong></div>
                </div>
                <div className="detail-item">
                  <label>Total Tokens</label>
                  <div><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedLog.total_tokens}</span></div>
                </div>
                <div className="detail-item">
                  <label>Prompt</label>
                  <div>{selectedLog.prompt_tokens}</div>
                </div>
                <div className="detail-item">
                  <label>Completion</label>
                  <div>{selectedLog.completion_tokens}</div>
                </div>
                <div className="detail-item">
                  <label>Latency</label>
                  <div>{selectedLog.latency_ms}ms</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div className="json-section">
                  <label>Messages Payload (Prompt)</label>
                  <pre style={{ height: '350px' }}>
                    {JSON.stringify(selectedLog.messages_payload, null, 2)}
                  </pre>
                </div>

                <div className="json-section">
                  <label>Model Response</label>
                  <pre style={{ height: '350px' }}>
                    {selectedLog.response_payload ? JSON.stringify(selectedLog.response_payload, null, 2) : 'No response body'}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
