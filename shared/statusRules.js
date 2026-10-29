export const STATUS_TRANSITIONS = Object.freeze({
  under_review: Object.freeze(['planned']),
  planned: Object.freeze(['under_review', 'shipped']),
  shipped: Object.freeze([]),
});

export const STATUSES = Object.freeze(Object.keys(STATUS_TRANSITIONS));

export function allowedStatuses(status) {
  return Object.hasOwn(STATUS_TRANSITIONS, status) ? STATUS_TRANSITIONS[status] : [];
}
