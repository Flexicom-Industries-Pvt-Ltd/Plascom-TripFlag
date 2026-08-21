'use client';

import { useState, useEffect } from 'react';
import './globals.css';

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [page, method, status, search]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page, limit: 50 });
      if (method) query.append('method', method);
      if (status) query.append('status', status);
      if (search) query.append('search', search);

      const res = await fetch(`/api/logs?${query.toString()}`);
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

  const getStatusClass = (status) => {
    if (!status) return 'status-unknown';
    if (status >= 200 && status < 300) return 'status-success';
    if (status >= 400 && status < 500) return 'status-warning';
    return 'status-error';
  };

  const getMethodClass = (method) => {
    return `method-${method.toLowerCase()}`;
  };

  return (
    <div className="layout">
      {/* Top Navbar */}
      <nav className="top-nav">
        <div className="nav-brand">
          <div className="logo-box">tf</div>
          <h2>TripFlag Log Center</h2>
        </div>
        <div className="nav-actions">
          <span>Enterprise Edition</span>
          <div className="avatar">A</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="header-section">
          <h1>API Traffic Logs</h1>
          <p>Real-time monitoring and payloads across the TripFlag system.</p>
        </div>

        {/* Filters */}
        <div className="filters-card">
          <input 
            type="text" 
            placeholder="Search endpoint URL..." 
            className="input-search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <select 
            className="select-filter"
            value={method}
            onChange={(e) => { setMethod(e.target.value); setPage(1); }}
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>
          <select 
            className="select-filter"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="200">200 OK</option>
            <option value="400">400 Bad Request</option>
            <option value="500">500 Server Error</option>
          </select>
        </div>

        {/* Data Table */}
        <div className="table-card">
          {loading && logs.length === 0 ? (
            <div className="loading-state">Loading logs...</div>
          ) : (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} onClick={() => setSelectedLog(log)} className="log-row">
                    <td className="time-cell">{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <span className={`badge-method ${getMethodClass(log.method)}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="url-cell">{log.url}</td>
                    <td>
                      <span className={`badge-status ${getStatusClass(log.response_status)}`}>
                        {log.response_status}
                      </span>
                    </td>
                    <td className="ms-cell">{log.response_time_ms}ms</td>
                    <td>
                      <button className="btn-view">View Details</button>
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Details</h2>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Method</label>
                  <div><span className={`badge-method ${getMethodClass(selectedLog.method)}`}>{selectedLog.method}</span></div>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <div><span className={`badge-status ${getStatusClass(selectedLog.response_status)}`}>{selectedLog.response_status}</span></div>
                </div>
                <div className="detail-item">
                  <label>Time</label>
                  <div>{selectedLog.response_time_ms}ms</div>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 3' }}>
                  <label>URL</label>
                  <div className="url-full">{selectedLog.url}</div>
                </div>
              </div>

              <div className="json-section">
                <label>Request Headers</label>
                <pre>{JSON.stringify(selectedLog.request_headers, null, 2)}</pre>
              </div>

              <div className="json-section">
                <label>Request Payload</label>
                <pre>{selectedLog.request_body ? JSON.stringify(selectedLog.request_body, null, 2) : 'No payload'}</pre>
              </div>

              <div className="json-section">
                <label>Response Payload</label>
                <pre>{selectedLog.response_body ? JSON.stringify(selectedLog.response_body, null, 2) : 'No response body'}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
