'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { MessageSquare, FileText, AlertTriangle, AlertCircle, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import RuleFormFields from '../components/RuleFormFields';
import { OPERATOR_LABELS } from '@/lib/rule-schema';

const EMPTY_FORM = {
  semanticField: '',
  fieldName: '',
  fieldType: 'text',
  operator: 'gt',
  value: '',
  valueEnd: '',
  unit: '',
  severity: 'warning',
};

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [fieldsCatalog, setFieldsCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [ruleToEdit, setRuleToEdit] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [chatMessages, setChatMessages] = useState([
    { type: 'system', text: 'Tell me what to flag. For example:\n"Flag if duration is above 30 minutes"\n"Flag if distance is more than 50 km"\n"Mark rows where status is STOPPAGE"' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchRules();
    fetchFields();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function fetchFields() {
    try {
      const res = await fetch('/api/fields');
      if (res.ok) {
        const data = await res.json();
        setFieldsCatalog(data.fields || []);
      }
    } catch (err) {
      console.error('Failed to fetch fields:', err);
    }
  }

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

  function updateForm(updates) {
    setForm(prev => ({ ...prev, ...updates }));
  }

  function buildPayload(formState, id = null) {
    const payload = {
      field_name: formState.fieldName,
      semantic_field: formState.semanticField || null,
      field_type: formState.fieldType,
      operator: formState.operator,
      value: formState.value,
      value_end: formState.operator === 'between' ? formState.valueEnd : null,
      unit: formState.unit || null,
      severity: formState.severity,
    };
    if (id) payload.id = id;
    return payload;
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
          text: data.error || 'Could not understand. Try again with a clearer description.',
        }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { type: 'error', text: 'Network error. Please check your connection.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    if (!form.semanticField) {
      toast.error('Please select a parameter');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create rule');

      setForm({ ...EMPTY_FORM });
      toast.success('Rule added successfully!');
      fetchRules();
    } catch (err) {
      toast.error(err.message || 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleRule(id, currentActive) {
    const originalRules = [...rules];
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentActive } : r));

    try {
      const res = await fetch('/api/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      fetchRules();
    } catch (err) {
      setRules(originalRules);
      toast.error('Failed to update rule');
    }
  }

  async function confirmDeleteRule() {
    if (!ruleToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/rules?id=${ruleToDelete}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setRuleToDelete(null);
      toast.success('Rule deleted');
      await fetchRules();
    } catch {
      toast.error('Failed to delete rule');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEditClick(rule) {
    setRuleToEdit({
      id: rule.id,
      ...EMPTY_FORM,
      semanticField: rule.semantic_field || '',
      fieldName: rule.field_name || '',
      fieldType: rule.field_type || 'text',
      operator: rule.operator || 'equals',
      value: rule.value || '',
      valueEnd: rule.value_end || '',
      unit: rule.unit || '',
      severity: rule.severity || 'warning',
    });
  }

  function updateEditForm(updates) {
    setRuleToEdit(prev => ({ ...prev, ...updates }));
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (!ruleToEdit?.semanticField) {
      toast.error('Please select a parameter');
      return;
    }

    setIsEditing(true);
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(ruleToEdit, ruleToEdit.id)),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update rule');

      setRuleToEdit(null);
      toast.success('Rule updated');
      fetchRules();
    } catch (err) {
      toast.error(err.message || 'Failed to update rule');
    } finally {
      setIsEditing(false);
    }
  }

  function formatRuleSummary(rule) {
    const op = OPERATOR_LABELS[rule.operator] || rule.operator;
    if (['is_empty', 'is_not_empty'].includes(rule.operator)) {
      return `${rule.field_name} ${op}`;
    }
    const unitStr = rule.unit ? ` ${rule.unit}` : '';
    if (rule.operator === 'between') {
      return `${rule.field_name} ${op} ${rule.value} – ${rule.value_end}${unitStr}`;
    }
    return `${rule.field_name} ${op} ${rule.value}${unitStr}`;
  }

  return (
    <>
      <div className="page-header">
        <img src="/Logo.png" alt="TripFlag" className="logo" />
        <div className="header-text">
          <h1>Flagging Rules</h1>
          <p>Define what to flag — works across all file formats</p>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <MessageSquare size={16} style={{ marginRight: '6px' }} /> Chat
        </button>
        <button type="button" className={`tab ${activeTab === 'form' ? 'active' : ''}`} onClick={() => setActiveTab('form')}>
          <FileText size={16} style={{ marginRight: '6px' }} /> Manual
        </button>
      </div>

      {activeTab === 'chat' && (
        <div className="chat-container">
          <div className="chat-messages">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.type}`}>{msg.text}</div>
            ))}
            {chatLoading && <div className="chat-bubble system" style={{ opacity: 0.6 }}>⏳ Thinking...</div>}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-input-row" onSubmit={handleChatSend}>
            <input
              className="input"
              placeholder='Try: "Flag if duration is above 30 minutes"'
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={chatLoading}
            />
            <button type="submit" className="btn btn-primary" disabled={chatLoading || !chatInput.trim()}>Send</button>
          </form>
        </div>
      )}

      {activeTab === 'form' && (
        <form onSubmit={handleFormSubmit}>
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <RuleFormFields
              idPrefix="create"
              fieldsCatalog={fieldsCatalog}
              semanticField={form.semanticField}
              fieldName={form.fieldName}
              fieldType={form.fieldType}
              operator={form.operator}
              value={form.value}
              valueEnd={form.valueEnd}
              unit={form.unit}
              severity={form.severity}
              onChange={updateForm}
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isSubmitting || !form.semanticField}>
              {isSubmitting ? <><span className="spinner spinner-sm" style={{ marginRight: '8px' }} /> Adding...</> : <><Plus size={16} /> Add Rule</>}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 'var(--space-xl)' }}>
        <h2 className="section-heading">Active Rules ({rules.filter(r => r.is_active).length})</h2>

        {loading ? (
          <div className="skeleton-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="rule-card" style={{ opacity: 1 }}>
                <div className="skeleton skeleton-icon" style={{ borderRadius: '50%', width: '40px', height: '40px' }} />
                <div className="rule-info" style={{ width: '100%' }}>
                  <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: '8px' }} />
                  <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : rules.length === 0 ? (
          <div className="empty-state">
            <h3>No rules yet</h3>
            <p>Create rules using chat or the manual form above.</p>
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="rule-card" style={{ opacity: rule.is_active ? 1 : 0.5 }}>
              <div className={`rule-icon ${rule.severity}`}>
                {rule.severity === 'critical' ? <AlertCircle size={24} /> : <AlertTriangle size={24} />}
              </div>
              <div className="rule-info">
                <div className="rule-label">{rule.label || formatRuleSummary(rule)}</div>
                <div className="rule-detail" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {rule.semantic_field && (
                    <span className="rule-badge">{rule.semantic_field}</span>
                  )}
                  {rule.field_type && (
                    <span className="rule-badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      {rule.field_type}
                    </span>
                  )}
                  <span>{formatRuleSummary(rule)}</span>
                </div>
              </div>
              <div className="rule-actions">
                <label className="toggle">
                  <input type="checkbox" checked={rule.is_active} onChange={() => toggleRule(rule.id, rule.is_active)} />
                  <span className="slider" />
                </label>
                <button type="button" className="btn btn-icon btn-secondary" onClick={() => handleEditClick(rule)} title="Edit">
                  <Pencil size={16} />
                </button>
                <button type="button" className="btn btn-icon btn-danger" onClick={() => setRuleToDelete(rule.id)} title="Delete">
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {ruleToDelete && (
        <div className="modal-overlay" onClick={() => setRuleToDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Delete Rule</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
              This rule will no longer flag future uploads.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRuleToDelete(null)} disabled={isDeleting}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteRule} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : <><Trash2 size={16} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {ruleToEdit && (
        <div className="modal-overlay" onClick={() => setRuleToEdit(null)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h2>Edit Rule</h2>
            <form onSubmit={handleEditSubmit} style={{ marginTop: 'var(--space-md)' }}>
              <RuleFormFields
                idPrefix="edit"
                fieldsCatalog={fieldsCatalog}
                semanticField={ruleToEdit.semanticField}
                fieldName={ruleToEdit.fieldName}
                fieldType={ruleToEdit.fieldType}
                operator={ruleToEdit.operator}
                value={ruleToEdit.value}
                valueEnd={ruleToEdit.valueEnd}
                unit={ruleToEdit.unit}
                severity={ruleToEdit.severity}
                onChange={updateEditForm}
              />
              <div className="modal-actions" style={{ marginTop: 'var(--space-xl)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRuleToEdit(null)} disabled={isEditing}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isEditing}>
                  {isEditing ? 'Saving...' : <><Save size={16} /> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </>
  );
}
