export const SEVERITY_RANK = { critical: 2, warning: 1 };

export function severityRank(severity) {
  return SEVERITY_RANK[severity] || 0;
}

/**
 * Pick the highest-severity flag per column field for cell highlighting.
 * When multiple rules fire on the same field (e.g. >30 warning, >100 critical),
 * the cell should reflect the worst severity.
 */
export function getCellFlagsByField(flagDetails) {
  const map = {};
  if (!flagDetails?.length) return map;

  for (const flag of flagDetails) {
    const key = flag.field;
    const existing = map[key];
    if (!existing || severityRank(flag.severity) > severityRank(existing.severity)) {
      map[key] = flag;
    }
  }

  return map;
}

/** Sort flags for display — critical first, then alphabetical by field. */
export function sortFlagsForDisplay(flagDetails) {
  return [...(flagDetails || [])].sort((a, b) => {
    const bySeverity = severityRank(b.severity) - severityRank(a.severity);
    if (bySeverity !== 0) return bySeverity;
    return (a.field || '').localeCompare(b.field || '');
  });
}

export function getRowMaxSeverity(flagDetails) {
  if (!flagDetails?.length) return null;
  return flagDetails.reduce(
    (max, flag) => (severityRank(flag.severity) > severityRank(max) ? flag.severity : max),
    'warning'
  );
}
