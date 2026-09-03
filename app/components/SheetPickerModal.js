'use client';

export default function SheetPickerModal({ sheets, recommended, onSelect, onCancel }) {
  if (!sheets || sheets.length === 0) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%' }}>
        <h2>Select Worksheet</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-md)' }}>
          This file has {sheets.length} sheets. Choose which one contains your trip data.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
          {sheets.map((sheet) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => onSelect(sheet.name)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '14px 16px',
                border: sheet.recommended ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: sheet.recommended ? 'var(--accent-light)' : 'var(--bg-secondary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.95rem' }}>{sheet.name}</strong>
                {sheet.recommended && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    background: 'white',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    Recommended
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {sheet.rowCount} data rows
                {sheet.hasDuration && ' · Duration'}
                {sheet.hasDistance && ' · Distance'}
                {sheet.hasStatus && ' · Status'}
              </div>
              {sheet.headers?.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sheet.headers.slice(0, 6).join(' · ')}
                  {sheet.headers.length > 6 ? ' …' : ''}
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="modal-actions" style={{ marginTop: 'var(--space-md)' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
