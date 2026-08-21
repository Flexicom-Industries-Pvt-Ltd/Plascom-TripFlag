'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, FileText, AlertTriangle, Check, Save } from 'lucide-react';

export default function ReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [tripName, setTripName] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTrip();
  }, [id]);

  async function fetchTrip() {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Trip not found');
      const data = await res.json();
      setTrip(data.trip);
      setRows(data.rows || []);
      setTripName(data.trip.name);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function confirmApprove() {
    setApproving(true);
    try {
      await fetch(`/api/trips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tripName, status: 'approved' }),
      });
      setShowNameModal(false);
      router.push('/history');
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    try {
      await fetch(`/api/trips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      router.push('/history');
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: '400px' }}>
        <div className="spinner" />
        <p>Loading trip data...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="empty-state">
        <h3>Trip not found</h3>
        <p>This trip does not exist.</p>
        <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => router.push('/history')}>
          Go to History
        </button>
      </div>
    );
  }

  const columnHeaders = trip.column_headers || [];
  const flaggedCount = rows.filter(r => r.is_flagged).length;
  const criticalCount = rows.filter(r => {
    const flags = r.flag_details || [];
    return flags.some(f => f.severity === 'critical');
  }).length;
  const warningCount = flaggedCount - criticalCount;

  const filteredRows = rows.filter(r => {
    if (filter === 'flagged') return r.is_flagged;
    if (filter === 'clean') return !r.is_flagged;
    return true;
  });

  function getCellFlags(flagDetails) {
    const map = {};
    if (!flagDetails || !Array.isArray(flagDetails)) return map;
    for (const flag of flagDetails) {
      map[flag.field] = flag;
    }
    return map;
  }

  return (
    <>
      <div className="review-header-premium">
        <div className="review-header-info">
          <h1>Review: {trip.name}</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> {trip.original_filename} &bull; {trip.total_rows} rows &bull; Uploaded {new Date(trip.uploaded_at).toLocaleDateString()}</p>
        </div>
        <div className="review-header-actions">
          {trip.status === 'pending' ? (
            <>
              <button className="btn btn-success" onClick={() => setShowNameModal(true)} id="approve-btn"><CheckCircle2 size={16} /> Approve Trip</button>
              <button className="btn btn-danger" onClick={() => setShowRejectModal(true)} id="reject-btn"><XCircle size={16} /> Reject Trip</button>
            </>
          ) : (
            <span className={`badge ${trip.status === 'approved' ? 'badge-success' : 'badge-critical'}`} style={{ fontSize: '1rem', padding: '12px 24px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {trip.status === 'approved' ? <><CheckCircle2 size={16} /> Approved</> : <><XCircle size={16} /> Rejected</>}
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flag-summary">
        <div className="flag-stat total">
          <span className="number">{trip.total_rows}</span>
          <span className="label">Total Rows</span>
        </div>
        <div className="flag-stat critical">
          <span className="number">{criticalCount}</span>
          <span className="label">Critical</span>
        </div>
        <div className="flag-stat warning">
          <span className="number">{warningCount}</span>
          <span className="label">Warnings</span>
        </div>
        <div className="flag-stat" style={{ marginLeft: '0' }}>
          <span className="number" style={{ color: flaggedCount > 0 ? 'var(--flag-critical)' : 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {flaggedCount > 0 ? `${flaggedCount} flagged` : <><Check size={24} /> Clean</>}
          </span>
          <span className="label">Status</span>
        </div>
      </div>



      {/* Filters */}
      <div className="tabs" style={{ maxWidth: '360px', marginBottom: 'var(--space-lg)' }}>
        <button type="button" className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All ({rows.length})
        </button>
        <button type="button" className={`tab ${filter === 'flagged' ? 'active' : ''}`} onClick={() => setFilter('flagged')}>
          <AlertTriangle size={16} style={{ marginRight: '6px' }} /> ({flaggedCount})
        </button>
        <button type="button" className={`tab ${filter === 'clean' ? 'active' : ''}`} onClick={() => setFilter('clean')}>
          <Check size={16} style={{ marginRight: '6px' }} /> ({rows.length - flaggedCount})
        </button>
      </div>

      {/* Data Table */}
      <div className="data-table-wrapper" style={{ maxHeight: '500px', overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              {columnHeaders.map((header, i) => (
                <th key={i}>{header}</th>
              ))}
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIdx) => {
              const cellFlags = getCellFlags(row.flag_details);
              return (
                <tr key={row.id || rowIdx}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{row.row_index + 1}</td>
                  {columnHeaders.map((header, colIdx) => {
                    const flag = cellFlags[header];
                    const cls = flag
                      ? flag.severity === 'critical' ? 'flagged-critical' : 'flagged-warning'
                      : '';
                    return (
                      <td key={colIdx} className={cls} title={flag ? flag.reason : ''}>
                        {String(row.row_data?.[header] ?? '')}
                      </td>
                    );
                  })}
                  <td>
                    {row.is_flagged ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(row.flag_details || []).map((f, fi) => (
                          <span key={fi} className={`badge ${f.severity === 'critical' ? 'badge-critical' : 'badge-warning'}`} title={f.reason}>
                            {f.field}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="badge badge-success"><Check size={12} /></span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom padding for scroll */}
      <div style={{ height: '40px' }}></div>

      {/* Name Modal */}
      {showNameModal && (
        <div className="modal-overlay" onClick={() => setShowNameModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Name this trip</h2>
            <div className="input-group">
              <label htmlFor="trip-name-input">Trip Name</label>
              <input
                className="input"
                id="trip-name-input"
                value={tripName}
                onChange={e => setTripName(e.target.value)}
                placeholder="Enter a name for this trip"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && tripName.trim()) confirmApprove(); }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowNameModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={confirmApprove} disabled={approving || !tripName.trim()} id="confirm-approve-btn">
                {approving ? <><span className="spinner spinner-sm" style={{ marginRight: '8px' }} /> Saving...</> : <><Save size={16} /> Approve & Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Reject Trip</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Are you sure you want to reject this trip? This will mark it as rejected in your history.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleReject}>
                <XCircle size={16} /> Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
