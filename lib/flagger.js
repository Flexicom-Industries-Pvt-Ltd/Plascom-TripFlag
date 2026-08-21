import Fuse from 'fuse.js';

/**
 * Run all active rules against parsed trip data rows.
 * Returns rows with flag annotations.
 */
export function runFlagging(rows, rules, columnHeaders) {
  if (!rows || !rules || rules.length === 0) return rows.map(r => ({ ...r, flags: [] }));

  // Build a fuzzy matcher for column name matching
  const fuseColumns = new Fuse(columnHeaders, {
    threshold: 0.4,
    distance: 100,
    includeScore: true,
  });

  const flaggedRows = rows.map((row) => {
    const flags = [];

    for (const rule of rules) {
      if (!rule.is_active) continue;

      // Find matching column: exact first, then fuzzy
      const matchedColumn = findMatchingColumn(rule.field_name, columnHeaders, fuseColumns);
      if (!matchedColumn) continue;

      const cellValue = row[matchedColumn];
      const isFlagged = evaluateRule(rule, cellValue);

      if (isFlagged) {
        let reasonStr = rule.label || `${matchedColumn} ${rule.operator} ${rule.value}`;
        if (!rule.label && rule.unit) {
           reasonStr += ` ${rule.unit}`;
        }
        
        flags.push({
          field: matchedColumn,
          rule_id: rule.id,
          rule_field: rule.field_name,
          operator: rule.operator,
          expected: rule.value,
          actual: cellValue,
          severity: rule.severity,
          reason: reasonStr,
        });
      }
    }

    return { ...row, flags };
  });

  return flaggedRows;
}

function findMatchingColumn(ruleFieldName, columnHeaders, fuseColumns) {
  const normalized = ruleFieldName.toLowerCase().trim();

  // Exact match (case insensitive)
  const exact = columnHeaders.find(h => h.toLowerCase().trim() === normalized);
  if (exact) return exact;

  // Fuzzy match
  const results = fuseColumns.search(ruleFieldName);
  if (results.length > 0 && results[0].score < 0.4) {
    return results[0].item;
  }

  return null;
}

function evaluateRule(rule, cellValue) {
  const { operator, value, value_end } = rule;

  if (operator === 'is_empty') {
    return cellValue === null || cellValue === undefined || String(cellValue).trim() === '';
  }

  if (operator === 'is_not_empty') {
    return cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '';
  }

  if (cellValue === null || cellValue === undefined) return false;

  const cellStr = String(cellValue).toLowerCase().trim();
  const ruleStr = String(value).toLowerCase().trim();

  // Strip text strings from cell values for numeric comparison (e.g. "150 kg" -> 150)
  const cellNumStr = cellStr.replace(/[^0-9.-]+/g, '');
  const ruleNumStr = ruleStr.replace(/[^0-9.-]+/g, '');
  
  const cellNum = parseFloat(cellNumStr);
  const ruleNum = parseFloat(ruleNumStr);
  const isNumeric = cellNumStr !== '' && ruleNumStr !== '' && !isNaN(cellNum) && !isNaN(ruleNum);

  switch (operator) {
    case 'equals':
      if (isNumeric) return cellNum === ruleNum;
      // Smart string matching: exact match or contains (word-wise)
      return cellStr === ruleStr || cellStr.includes(ruleStr);

    case 'not_equals':
      if (isNumeric) return cellNum !== ruleNum;
      return cellStr !== ruleStr && !cellStr.includes(ruleStr);

    case 'contains':
      // Fuzzy contains — use fuse on the cell value
      const fuseCellCheck = new Fuse([cellStr], { threshold: 0.3 });
      const containsResults = fuseCellCheck.search(ruleStr);
      return cellStr.includes(ruleStr) || containsResults.length > 0;

    case 'not_contains':
      return !cellStr.includes(ruleStr);

    case 'gt':
      return isNumeric && cellNum > ruleNum;

    case 'lt':
      return isNumeric && cellNum < ruleNum;

    case 'gte':
      return isNumeric && cellNum >= ruleNum;

    case 'lte':
      return isNumeric && cellNum <= ruleNum;

    case 'between':
      const endNum = parseFloat(value_end);
      return isNumeric && !isNaN(endNum) && cellNum >= ruleNum && cellNum <= endNum;

    default:
      return false;
  }
}
