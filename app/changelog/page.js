import React from 'react';
import changelogData from '../../changelog.json';
import { GitCommit, Star, Wrench, Zap, FileText } from 'lucide-react';

export const metadata = {
  title: 'Changelog - TripFlag',
};

export default function ChangelogPage() {
  function getTypeIcon(type) {
    switch (type) {
      case 'feat':
        return <Star size={14} className="text-primary" />;
      case 'fix':
        return <Wrench size={14} className="text-warning" />;
      case 'style':
        return <Zap size={14} className="text-accent" />;
      default:
        return <GitCommit size={14} className="text-muted" />;
    }
  }

  function getTypeLabel(type) {
    switch (type) {
      case 'feat':
        return 'Feature';
      case 'fix':
        return 'Fix';
      case 'style':
        return 'Polish';
      default:
        return 'Update';
    }
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 'var(--space-2xl)' }}>
        <img src="/Logo.png" alt="TripFlag" className="logo" />
        <div className="header-text">
          <h1>Changelog</h1>
          <p>System updates, improvements, and new features</p>
        </div>
      </div>

      <div className="changelog-container">
        {changelogData.map((release, index) => (
          <div key={index} className="release-card">
            <div className="release-header">
              <div className="release-version-badge">
                <FileText size={16} />
                <span>{release.version}</span>
              </div>
              <div className="release-date">{new Date(release.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
            
            <h2 className="release-title">{release.title}</h2>
            
            <ul className="release-changes">
              {release.changes.map((change, cIdx) => (
                <li key={cIdx} className="change-item">
                  <div className={`change-type-badge type-${change.type}`}>
                    {getTypeIcon(change.type)}
                    <span>{getTypeLabel(change.type)}</span>
                  </div>
                  <span className="change-text">{change.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
