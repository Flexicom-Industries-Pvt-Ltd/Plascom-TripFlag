/**
 * Normalize enum/status values to canonical lowercase tokens.
 */

export const STATUS_SYNONYMS = {
  stoppage: 'stopped',
  stopped: 'stopped',
  stop: 'stopped',
  driving: 'moving',
  moving: 'moving',
  drive: 'moving',
  idling: 'idling',
  idle: 'idling',
  ignition_on: 'ignition_on',
  ignition_off: 'ignition_off',
  on: 'on',
  off: 'off',
};

export function parseEnum(value, hints = {}) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: null, raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');

  const category = hints.enumCategory || 'status';
  if (category === 'status' || category === 'vehicle_status') {
    const canonical = STATUS_SYNONYMS[normalized] || normalized;
    return { value: canonical, unit: null, raw, parseable: true };
  }

  if (category === 'ignition') {
    const ignitionMap = { on: 'on', off: 'off', yes: 'on', no: 'off' };
    const canonical = ignitionMap[normalized] || normalized;
    return { value: canonical, unit: null, raw, parseable: true };
  }

  return { value: normalized, unit: null, raw, parseable: true };
}

export function parseEnumRule(value) {
  return parseEnum(value, { enumCategory: 'status' });
}
