'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HistoryPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [filter, setFilter] = useState('all');
  const [tripToDelete, setTripToDelete] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchTrips();
  }, []);

  async function fetchTrips() {
    try {
      const res = await fetch('/api/trips');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch trips:', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRename(id) {
    if (!editName.trim()) return;
    try {
      await fetch(`/api/trips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditingId(null);
      fetchTrips();
    } catch (err) {
      console.error(err);
    }
  }

  function handleDeleteClick(id) {
    setTripToDelete(id);
  }

  async function confirmDelete() {
    if (!tripToDelete) return;
    try {
      await fetch(`/api/trips/${tripToDelete}`, { method: 'DELETE' });
      setTripToDelete(null);
      fetchTrips();
    } catch (err) {
      console.error(err);
    }
  }

  const filteredTrips = trips.filter(t => {
    if (filter === 'approved') return t.status === 'approved';
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'rejected') return t.status === 'rejected';
    return true;
  });

  return (
    <>
      <div className="page-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <img src="/Logo.png" alt="TripFlag" className="logo" />
        <div className="header-text">
          <h1>Trip History</h1>
          <p>{trips.length} trips uploaded</p>
        </div>
      </div>

      {/* Filters */}
      <div className="tabs" style={{ maxWidth: '480px' }}>
        <button type="button" className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All ({trips.length})
        </button>
        <button type="button" className={`tab ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>
          ✅ Approved
        </button>
        <button type="button" className={`tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          ⏳ Pending
        </button>
        <button type="button" className={`tab ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>
          ❌ Rejected
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay" style={{ minHeight: '300px' }}><div className="spinner" /></div>
      ) : filteredTrips.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 'var(--space-2xl)' }}>
          <h3>No trips found</h3>
          <p>Upload a file to get started.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => router.push('/upload')}>
            📤 Upload File
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          {filteredTrips.map(trip => (
            <div key={trip.id} className="trip-card">
              <div className="trip-header">
                <div style={{ flex: 1 }}>
                  {editingId === trip.id ? (
                    <div className="inline-edit">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(trip.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handleRename(trip.id)}>Save</button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="trip-name">{trip.name}</div>
                  )}
                  <div className="trip-meta">
                    📄 {trip.original_filename} • {trip.total_rows} rows • {new Date(trip.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span className={`badge ${trip.status === 'approved' ? 'badge-success' : trip.status === 'rejected' ? 'badge-critical' : 'badge-warning'}`}>
                  {trip.status === 'approved' ? '✅ Approved' : trip.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                </span>
              </div>

              <div className="trip-flags">
                {trip.flagged_rows > 0 ? (
                  <span className="badge badge-critical">🚩 {trip.flagged_rows} flagged</span>
                ) : (
                  <span className="badge badge-success">✓ No flags</span>
                )}
                <span className="badge badge-neutral">{(trip.file_type || 'xlsx').toUpperCase()}</span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => router.push(`/review/${trip.id}`)}>
                  👁 View
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setEditingId(trip.id); setEditName(trip.name); }}>
                  ✏️ Rename
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteClick(trip.id)}>
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Delete Modal */}
      {tripToDelete && (
        <div className="modal-overlay" onClick={() => setTripToDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete Trip</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Are you sure you want to delete this trip? This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setTripToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
