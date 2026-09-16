/**
 * Normalizes FastAPI error detail into a human-readable string.
 * Handles string details, arrays of Pydantic validation error objects ({loc, msg, type}),
 * or generic error objects.
 */
export const parseApiError = (detail) => {
  if (!detail) return 'An unexpected error occurred.';
  if (typeof detail === 'string') return detail;
  
  if (Array.isArray(detail)) {
    return detail
      .map(d => {
        if (typeof d === 'string') return d;
        const field = Array.isArray(d.loc) ? d.loc.at(-1) : d.loc || '';
        const msg = d.msg || d.message || JSON.stringify(d);
        return field ? `${field}: ${msg}` : msg;
      })
      .join('; ');
  }
  
  if (typeof detail === 'object') {
    if (detail.message) return detail.message;
    if (detail.msg) return detail.msg;
    return JSON.stringify(detail);
  }
  
  return String(detail);
};
