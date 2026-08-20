'use client';

import { useState, useEffect, useRef } from 'react';

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'gte', label: 'Greater or Equal (>=)' },
  { value: 'lte', label: 'Less or Equal (<=)' },
  { value: 'between', label: 'Between' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [ruleToEdit, setRuleToEdit] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { type: 'system', text: 'Tell me what to flag. For example:\n"Flag if fuel is above 50"\n"Mark rows where driver name is empty"' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState('');
  const [valueEnd, setValueEnd] = useState('');
  const [unit, setUnit] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  async function fetchRules() {
    try {
      const res = await fetch('/api/rules');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleChatSend(e) {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { type: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });

      const data = await res.json();

      if (data.success) {
        setChatMessages(prev => [...prev, { type: 'system', text: data.message }]);
        fetchRules();
      } else {
        setChatMessages(prev => [...prev, {
          type: 'error',
          text: data.error || 'Could not understand. Try again with a clearer description.'
        }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, {
        type: 'error',
        text: 'Network error. Please check your connection and try again.'
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!fieldName.trim()) {
      setFormError('Field name is required');
      return;
    }

    const needsVal = !['is_empty', 'is_not_empty'].includes(operator);
    if (needsVal && !value.trim()) {
      setFormError('Value is required for this condition');
      return;
    }

    const opLabel = OPERATORS.find(o => o.value === operator)?.label || operator;
    const unitStr = unit.trim() ? ` ${unit.trim()}` : '';
    const label = `${fieldName.trim()} ${opLabel} ${value.trim()}${valueEnd.trim() ? ` and ${valueEnd.trim()}` : ''}${unitStr}`.trim();

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: fieldName.trim(),
          operator,
          value: value.trim(),
          value_end: operator === 'between' ? valueEnd.trim() : null,
          unit: unit.trim() || null,
          severity,
          label,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create rule');
      }

      setFieldName('');
      setValue('');
      setValueEnd('');
      setUnit('');
      setOperator('equals');
      setSeverity('warning');
      setFormSuccess('Rule added successfully!');
      setTimeout(() => setFormSuccess(''), 3000);
      fetchRules();
    } catch (err) {
      setFormError(err.message || 'Failed to create rule');
    }
  }

  async function toggleRule(id, currentActive) {
    try {
      await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      fetchRules();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  }

  async function confirmDeleteRule() {
    if (!ruleToDelete) return;
    try {
      await fetch(`/api/rules?id=${ruleToDelete}`, { method: 'DELETE' });
      setRuleToDelete(null);
      fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  }

  function handleEditClick(rule) {
    setRuleToEdit({
      id: rule.id,
      fieldName: rule.field_name || '',
      operator: rule.operator || 'equals',
      value: rule.value || '',
      valueEnd: rule.value_end || '',
      unit: rule.unit || '',
      severity: rule.severity || 'warning',
      label: rule.label || '',
      formError: '',
    });
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!ruleToEdit.fieldName.trim()) {
      setRuleToEdit({ ...ruleToEdit, formError: 'Field name is required' });
      return;
    }

    const needsVal = !['is_empty', 'is_not_empty'].includes(ruleToEdit.operator);
    if (needsVal && !ruleToEdit.value.trim()) {
      setRuleToEdit({ ...ruleToEdit, formError: 'Value is required for this condition' });
      return;
    }

    const opLabel = OPERATORS.find(o => o.value === ruleToEdit.operator)?.label || ruleToEdit.operator;
    const unitStr = ruleToEdit.unit.trim() ? ` ${ruleToEdit.unit.trim()}` : '';
    const label = `${ruleToEdit.fieldName.trim()} ${opLabel} ${ruleToEdit.value.trim()}${ruleToEdit.valueEnd.trim() ? ` and ${ruleToEdit.valueEnd.trim()}` : ''}${unitStr}`.trim();

    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ruleToEdit.id,
          field_name: ruleToEdit.fieldName.trim(),
          operator: ruleToEdit.operator,
          value: ruleToEdit.value.trim(),
          value_end: ruleToEdit.operator === 'between' ? ruleToEdit.valueEnd.trim() : null,
          unit: ruleToEdit.unit.trim() || null,
          severity: ruleToEdit.severity,
          label,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update rule');
      }

      setRuleToEdit(null);
      fetchRules();
    } catch (err) {
      setRuleToEdit({ ...ruleToEdit, formError: err.message || 'Failed to update rule' });
    }
  }

  const needsValue = !['is_empty', 'is_not_empty'].includes(operator);

  return (
    <>
      <div className="page-header">
        <img src="/Logo.png" alt="TripFlag" className="logo" />
        <div className="header-text">
          <h1>Flagging Rules</h1>
          <p>Define what values to flag in uploaded trip files</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          📝 Manual
        </button>
      </div>

      {/* Chat Mode */}
      {activeTab === 'chat' && (
        <div className="chat-container">
          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.type}`}>
                {msg.text}
              </div>
            ))}
            {chatLoading && (
              <div className="chat-bubble system" style={{ opacity: 0.6 }}>
                ⏳ Thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleChatSend}>
            <input
              className="input"
              placeholder='Try: "Flag if distance is more than 500"'
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
              id="chat-rule-input"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={chatLoading || !chatInput.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Manual Mode */}
      {activeTab === 'form' && (
        <form onSubmit={handleFormSubmit}>
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
              <div className="input-group">
                <label htmlFor="rule-field-name">Field Name</label>
                <input
                  className="input"
                  id="rule-field-name"
                  placeholder="e.g. Fuel, Distance, Status"
                  value={fieldName}
                  onChange={e => setFieldName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label htmlFor="rule-operator">Condition</label>
                <select
                  className="select"
                  id="rule-operator"
                  value={operator}
                  onChange={e => setOperator(e.target.value)}
                >
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="rule-severity">Severity</label>
                <select
                  className="select"
                  id="rule-severity"
                  value={severity}
                  onChange={e => setSeverity(e.target.value)}
                >
                  <option value="warning">⚠️ Warning</option>
                  <option value="critical">🔴 Critical</option>
                </select>
              </div>
            </div>

            {needsValue && (
              <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="input-group">
                  <label htmlFor="rule-value">Value</label>
                  <input
                    className="input"
                    id="rule-value"
                    placeholder="e.g. 50, Delayed"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                  />
                </div>
                {operator === 'between' && (
                  <div className="input-group">
                    <label htmlFor="rule-value-end">End Value</label>
                    <input
                      className="input"
                      id="rule-value-end"
                      placeholder="e.g. 100"
                      value={valueEnd}
                      onChange={e => setValueEnd(e.target.value)}
                    />
                  </div>
                )}
                <div className="input-group">
                  <label htmlFor="rule-unit">Unit (Optional)</label>
                  <input
                    className="input"
                    id="rule-unit"
                    placeholder="e.g. kg, liters, km"
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                  />
                </div>
              </div>
            )}

            {formError && (
              <p style={{ color: 'var(--flag-critical)', fontSize: '0.85rem', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                ❌ {formError}
              </p>
            )}

            {formSuccess && (
              <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                ✅ {formSuccess}
              </p>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} id="add-rule-btn">
              ➕ Add Rule
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <h2 className="section-heading">
          Active Rules ({rules.filter(r => r.is_active).length})
        </h2>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /></div>
        ) : rules.length === 0 ? (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <h3>No rules yet</h3>
            <p>Use the chat or manual form above to create your first flagging rule.</p>
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="rule-card" style={{ opacity: rule.is_active ? 1 : 0.5 }}>
              <div className={`rule-icon ${rule.severity}`}>
                {rule.severity === 'critical' ? '🔴' : '⚠️'}
              </div>
              <div className="rule-info">
                <div className="rule-label">{rule.label || `${rule.field_name} ${rule.operator} ${rule.value}${rule.unit ? ` ${rule.unit}` : ''}`}</div>
                <div className="rule-detail">
                  Field: <strong>{rule.field_name}</strong> &bull; {OPERATORS.find(o => o.value === rule.operator)?.label || rule.operator} {rule.value}{rule.value_end ? ` – ${rule.value_end}` : ''}{rule.unit ? ` ${rule.unit}` : ''}
                </div>
              </div>
              <div className="rule-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={() => toggleRule(rule.id, rule.is_active)}
                  />
                  <span className="slider" />
                </label>
                <button
                  type="button"
                  className="btn btn-icon btn-secondary"
                  onClick={() => handleEditClick(rule)}
                  title="Edit rule"
                  style={{ marginRight: '8px' }}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="btn btn-icon btn-danger"
                  onClick={() => setRuleToDelete(rule.id)}
                  title="Delete rule"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Rule Modal */}
      {ruleToDelete && (
        <div className="modal-overlay" onClick={() => setRuleToDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete Rule</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
              Are you sure you want to delete this rule? It will no longer flag future uploads.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRuleToDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteRule}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {ruleToEdit && (
        <div className="modal-overlay" onClick={() => setRuleToEdit(null)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h2>Edit Rule</h2>
            <form onSubmit={handleEditSubmit} style={{ marginTop: 'var(--space-md)' }}>
              <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
                <div className="input-group">
                  <label htmlFor="edit-field-name">Field Name</label>
                  <input
                    className="input"
                    id="edit-field-name"
                    value={ruleToEdit.fieldName}
                    onChange={e => setRuleToEdit({ ...ruleToEdit, fieldName: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="edit-operator">Condition</label>
                  <select
                    className="select"
                    id="edit-operator"
                    value={ruleToEdit.operator}
                    onChange={e => setRuleToEdit({ ...ruleToEdit, operator: e.target.value })}
                  >
                    {OPERATORS.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="edit-severity">Severity</label>
                  <select
                    className="select"
                    id="edit-severity"
                    value={ruleToEdit.severity}
                    onChange={e => setRuleToEdit({ ...ruleToEdit, severity: e.target.value })}
                  >
                    <option value="warning">⚠️ Warning</option>
                    <option value="critical">🔴 Critical</option>
                  </select>
                </div>
              </div>

              {!['is_empty', 'is_not_empty'].includes(ruleToEdit.operator) && (
                <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
                  <div className="input-group">
                    <label htmlFor="edit-value">Value</label>
                    <input
                      className="input"
                      id="edit-value"
                      value={ruleToEdit.value}
                      onChange={e => setRuleToEdit({ ...ruleToEdit, value: e.target.value })}
                    />
                  </div>
                  {ruleToEdit.operator === 'between' && (
                    <div className="input-group">
                      <label htmlFor="edit-value-end">End Value</label>
                      <input
                        className="input"
                        id="edit-value-end"
                        value={ruleToEdit.valueEnd}
                        onChange={e => setRuleToEdit({ ...ruleToEdit, valueEnd: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="input-group">
                    <label htmlFor="edit-unit">Unit (Optional)</label>
                    <input
                      className="input"
                      id="edit-unit"
                      value={ruleToEdit.unit}
                      onChange={e => setRuleToEdit({ ...ruleToEdit, unit: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {ruleToEdit.formError && (
                <p style={{ color: 'var(--flag-critical)', fontSize: '0.85rem', marginBottom: 'var(--space-md)', fontWeight: 600 }}>
                  ❌ {ruleToEdit.formError}
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRuleToEdit(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  💾 Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
