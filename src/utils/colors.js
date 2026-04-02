export const STATUS_COLORS = {
  pending: { bg: '#f3f4f6', border: '#9ca3af', text: '#6b7280' },
  active: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  complete: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  blocked: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
};

// Type-based header colours (fixed, never change with status)
export const TYPE_HEADER_COLORS = {
  work_package: '#EA580C',  // orange
  decision: '#DB2777',      // hot pink
  checkpoint: '#7C3AED',    // purple
};

// Status dot/text colours for the status bar
export const STATUS_ACCENT = {
  pending: '#4B5563',
  active: '#3B82F6',
  complete: '#22C55E',
  blocked: '#EF4444',
};

export const STAGE_COLORS = [
  '#e0e7ff', // 0 - indigo tint
  '#dbeafe', // 1 - blue tint
  '#e0f2fe', // 2 - sky tint
  '#ccfbf1', // 3 - teal tint
  '#d1fae5', // 4 - emerald tint
  '#fef9c3', // 5 - yellow tint
  '#fee2e2', // 6 - red tint
  '#f3e8ff', // 7 - purple tint
];
