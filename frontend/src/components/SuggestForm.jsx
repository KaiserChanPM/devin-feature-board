import { useState } from 'react';
import { DESCRIPTION_MAX, TITLE_MAX, validateIdea } from '../../../shared/ideaRules.js';
import { createIdea } from '../api.js';

const EMPTY = { title: '', description: '' };

export default function SuggestForm({ onCreated }) {
  const [fields, setFields] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [success, setSuccess] = useState(null);

  function handleChange(event) {
    const next = { ...fields, [event.target.name]: event.target.value };
    setFields(next);
    setSuccess(null);
    // After the first submit attempt, errors update as the visitor fixes them.
    if (submitted) setErrors(validateIdea(next).errors);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setApiError(null);
    setSuccess(null);

    const { value, errors: nextErrors } = validateIdea(fields);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid).focus();
      return;
    }

    setSending(true);
    try {
      const idea = await createIdea(value);
      setFields(EMPTY);
      setErrors({});
      setSubmitted(false);
      setSuccess(`Thanks! "${idea.title}" was added.`);
      onCreated?.(idea);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="suggest" aria-labelledby="suggest-heading">
      <h2 id="suggest-heading" className="suggest__heading">
        Suggest a feature
      </h2>
      <form className="suggest__form" onSubmit={handleSubmit} noValidate>
        <Field
          name="title"
          label="Title"
          value={fields.title}
          max={TITLE_MAX}
          error={errors.title}
          onChange={handleChange}
        />
        <Field
          name="description"
          label="Description (optional)"
          value={fields.description}
          max={DESCRIPTION_MAX}
          error={errors.description}
          onChange={handleChange}
          multiline
        />
        {apiError && (
          <p className="form-message form-message--error" role="alert">
            Couldn't add your idea: {apiError}
          </p>
        )}
        {success && (
          <p className="form-message form-message--success" role="status">
            {success}
          </p>
        )}
        <div className="suggest__actions">
          <button type="submit" className="button button--primary" disabled={sending}>
            {sending ? 'Submitting…' : 'Submit idea'}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ name, label, value, max, error, onChange, multiline = false }) {
  const id = `idea-${name}`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const Input = multiline ? 'textarea' : 'input';
  const over = value.trim().length > max;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        name={name}
        className="field__input"
        value={value}
        onChange={onChange}
        rows={multiline ? 3 : undefined}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${errorId} ${countId}` : countId}
      />
      <div className="field__meta">
        <span id={errorId} className="field__error">
          {error}
        </span>
        <span id={countId} className={`field__count${over ? ' field__count--over' : ''}`}>
          {value.trim().length}/{max}
        </span>
      </div>
    </div>
  );
}
