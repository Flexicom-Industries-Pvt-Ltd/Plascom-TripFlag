'use client';

import { OPERATOR_LABELS } from '@/lib/rule-schema';

export default function RuleFormFields({
  semanticField,
  fieldName,
  fieldType,
  operator,
  value,
  valueEnd,
  unit,
  severity,
  fieldsCatalog,
  onChange,
  idPrefix = 'rule',
}) {
  const selectedMeta = fieldsCatalog.find(f => f.key === semanticField) || null;
  const operators = selectedMeta?.operators || Object.keys(OPERATOR_LABELS);
  const units = selectedMeta?.units || [];
  const needsValue = !['is_empty', 'is_not_empty'].includes(operator);
  const enumSuggestions = selectedMeta?.enumSuggestions;

  function handleSemanticChange(key) {
    const meta = fieldsCatalog.find(f => f.key === key);
    if (!meta) {
      onChange({ semanticField: key, fieldName: key, fieldType: 'text', unit: '' });
      return;
    }

    const defaultOp = meta.operators.includes(operator) ? operator : meta.operators[0];

    onChange({
      semanticField: key,
      fieldName: meta.label,
      fieldType: meta.type,
      unit: meta.defaultUnit || '',
      operator: defaultOp,
    });
  }

  return (
    <>
      <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="input-group" style={{ flex: 2 }}>
          <label htmlFor={`${idPrefix}-semantic-field`}>Parameter</label>
          <select
            className="select"
            id={`${idPrefix}-semantic-field`}
            value={semanticField}
            onChange={e => handleSemanticChange(e.target.value)}
          >
            <option value="">Select a parameter...</option>
            {fieldsCatalog.map(f => (
              <option key={f.key} value={f.key}>
                {f.label} ({f.type})
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label htmlFor={`${idPrefix}-operator`}>Condition</label>
          <select
            className="select"
            id={`${idPrefix}-operator`}
            value={operator}
            onChange={e => onChange({ operator: e.target.value })}
          >
            {operators.map(op => (
              <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label htmlFor={`${idPrefix}-severity`}>Severity</label>
          <select
            className="select"
            id={`${idPrefix}-severity`}
            value={severity}
            onChange={e => onChange({ severity: e.target.value })}
          >
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {semanticField && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
          Works across all formats as <strong>{semanticField}</strong>
          {fieldType && <> · Type: <strong>{fieldType}</strong></>}
        </p>
      )}

      {needsValue && (
        <div className="form-row" style={{ marginBottom: 'var(--space-md)' }}>
          <div className="input-group">
            <label htmlFor={`${idPrefix}-value`}>Value</label>
            {fieldType === 'boolean' ? (
              <select
                className="select"
                id={`${idPrefix}-value`}
                value={value}
                onChange={e => onChange({ value: e.target.value })}
              >
                <option value="">Select...</option>
                <option value="Yes">Yes / On</option>
                <option value="No">No / Off</option>
              </select>
            ) : (
              <>
                <input
                  className="input"
                  id={`${idPrefix}-value`}
                  list={enumSuggestions ? `${idPrefix}-enum-suggestions` : undefined}
                  placeholder={selectedMeta?.valuePlaceholder || 'Enter value'}
                  value={value}
                  onChange={e => onChange({ value: e.target.value })}
                />
                {enumSuggestions && (
                  <datalist id={`${idPrefix}-enum-suggestions`}>
                    {enumSuggestions.map(s => <option key={s} value={s} />)}
                  </datalist>
                )}
              </>
            )}
          </div>

          {operator === 'between' && (
            <div className="input-group">
              <label htmlFor={`${idPrefix}-value-end`}>End Value</label>
              <input
                className="input"
                id={`${idPrefix}-value-end`}
                placeholder="e.g. 100"
                value={valueEnd}
                onChange={e => onChange({ valueEnd: e.target.value })}
              />
            </div>
          )}

          {units.length > 0 && (
            <div className="input-group">
              <label htmlFor={`${idPrefix}-unit`}>Unit</label>
              <select
                className="select"
                id={`${idPrefix}-unit`}
                value={unit}
                onChange={e => onChange({ unit: e.target.value })}
              >
                {units.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </>
  );
}
