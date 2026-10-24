// Rules for a new idea, shared by the API (backend/src/routes/ideas.js) and the form
// (frontend/src/components/SuggestForm.jsx) so both always agree.

export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function titleError(title) {
  if (title === undefined || title === null || title === '') return 'Title is required';
  if (typeof title !== 'string') return 'Title must be text';
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    return `Title must be ${TITLE_MIN}–${TITLE_MAX} characters`;
  }
  return undefined;
}

function descriptionError(description) {
  if (description === undefined || description === null) return undefined;
  if (typeof description !== 'string') return 'Description must be text';
  if (description.length > DESCRIPTION_MAX) {
    return `Description must be ${DESCRIPTION_MAX} characters or fewer`;
  }
  return undefined;
}

// Trims title and description and checks them. Any other field (such as status) is dropped.
// Returns { value: { title, description }, errors: { title?, description? } }.
export function validateIdea(input) {
  const title = trimmed(input?.title);
  const description = trimmed(input?.description);

  const errors = {};
  const titleMessage = titleError(title);
  const descriptionMessage = descriptionError(description);
  if (titleMessage) errors.title = titleMessage;
  if (descriptionMessage) errors.description = descriptionMessage;

  return { value: { title, description: description ?? '' }, errors };
}
