'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Clock, Upload, FileText, Eye, Pencil, Trash2, Check, AlertTriangle } from 'lucide-react';

export default function HistoryPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [filter, setFilter] = useState('all');
  const [tripToDelete, setTripToDelete] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
    setIsRenaming(true);
    try {
      await fetch(`/api/trips/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      toast.success('Trip renamed');
      await fetchTrips();
    } catch (err) {
      toast.error('Failed to rename trip');
      console.error(err);
    } finally {
      setIsRenaming(false);
    }
  }

  function handleDeleteClick(id) {
    setTripToDelete(id);
  }

  async function confirmDelete() {
    if (!tripToDelete) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/trips/${tripToDelete}`, { method: 'DELETE' });
      setTripToDelete(null);
      toast.success('Trip deleted');
      await fetchTrips();
    } catch (err) {
      toast.error('Failed to delete trip');
      console.error(err);
    } finally {
      setIsDeleting(false);
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
          <CheckCircle2 size={16} style={{ marginRight: '6px' }} /> Approved
        </button>
        <button type="button" className={`tab ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          <Clock size={16} style={{ marginRight: '6px' }} /> Pending
        </button>
        <button type="button" className={`tab ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>
          <XCircle size={16} style={{ marginRight: '6px' }} /> Rejected
        </button>
      </div>

      {loading ? (
        <div className="skeleton-list" style={{ marginTop: 'var(--space-lg)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="trip-card">
              <div className="trip-header">
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '8px', height: '18px' }} />
                  <div className="skeleton skeleton-text" style={{ width: '60%', height: '12px' }} />
                </div>
                <div className="skeleton skeleton-text" style={{ width: '80px', height: '24px', borderRadius: '12px' }} />
              </div>
              <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px', marginTop: '16px', borderRadius: '12px' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <div className="skeleton skeleton-tab" style={{ width: '60px', height: '30px' }} />
                <div className="skeleton skeleton-tab" style={{ width: '70px', height: '30px' }} />
                <div className="skeleton skeleton-tab" style={{ width: '70px', height: '30px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 'var(--space-2xl)' }}>
          <h3>No trips found</h3>
          <p>Upload a file to get started.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => router.push('/upload')}>
            <Upload size={16} /> Upload File
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
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => handleRename(trip.id)} disabled={isRenaming}>
                        {isRenaming ? <><span className="spinner spinner-sm" style={{ marginRight: '4px' }} /> Saving...</> : 'Save'}
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)} disabled={isRenaming}>Cancel</button>
                    </div>
                  ) : (
                    <div className="trip-name">{trip.name}</div>
                  )}
                  <div className="trip-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={14} /> {trip.original_filename} • {trip.total_rows} rows • {new Date(trip.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span className={`badge ${trip.status === 'approved' ? 'badge-success' : trip.status === 'rejected' ? 'badge-critical' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {trip.status === 'approved' ? <><CheckCircle2 size={14} /> Approved</> : trip.status === 'rejected' ? <><XCircle size={14} /> Rejected</> : <><Clock size={14} /> Pending</>}
                </span>
              </div>

              <div className="trip-flags">
                {trip.flagged_rows > 0 ? (
                  <span className="badge badge-critical" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> {trip.flagged_rows} flagged</span>
                ) : (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> No flags</span>
                )}
                <span className="badge badge-neutral">{(trip.file_type || 'xlsx').toUpperCase()}</span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => router.push(`/review/${trip.id}`)}>
                  <Eye size={14} /> View
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setEditingId(trip.id); setEditName(trip.name); }}>
                  <Pencil size={14} /> Rename
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteClick(trip.id)}>
                  <Trash2 size={14} /> Delete
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
              <button type="button" className="btn btn-secondary" onClick={() => setTripToDelete(null)} disabled={isDeleting}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? <><span className="spinner spinner-sm" style={{ marginRight: '8px' }} /> Deleting...</> : <><Trash2 size={16} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
