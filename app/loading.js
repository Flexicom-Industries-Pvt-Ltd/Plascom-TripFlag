export default function Loading() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-header">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-subtitle"></div>
      </div>
      <div className="skeleton-tabs">
        <div className="skeleton skeleton-tab"></div>
        <div className="skeleton skeleton-tab"></div>
      </div>
      <div className="skeleton-card">
        <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
        <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
        <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
      </div>
    </div>
  );
}
