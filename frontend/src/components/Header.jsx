import { useState } from 'react';

export default function Header({ admin }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  function close() {
    setOpen(false);
    setValue('');
    admin.exit();
  }

  async function submit(event) {
    event.preventDefault();
    const submitted = value;
    setValue('');
    await admin.unlock(submitted);
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <h1 className="header__title">Feature Request Board</h1>
        <button type="button" className="button" onClick={admin.passcode ? close : () => setOpen(true)}>
          {admin.passcode ? 'Exit admin' : 'Admin'}
        </button>
      </div>
      <div className="container">
        {admin.passcode ? (
          <p className="admin-message" role="status">Admin mode is on</p>
        ) : (open || admin.checking) && (
          <form className="admin-form" onSubmit={submit} aria-label="Unlock admin">
            <div className="field">
              <label className="field__label" htmlFor="admin-passcode">Admin passcode</label>
              <input id="admin-passcode" type="password" className="field__input"
                autoComplete="current-password" value={value} required disabled={admin.checking}
                onChange={(event) => setValue(event.target.value)} />
            </div>
            <div className="admin-actions">
              <button className="button button--primary" type="submit" disabled={admin.checking}>
                {admin.checking ? 'Checking…' : 'Unlock admin'}
              </button>
              <button className="button" type="button" onClick={close}>Cancel</button>
            </div>
          </form>
        )}
        {admin.message && <p className="admin-message form-message--error" role="alert">{admin.message}</p>}
      </div>
    </header>
  );
}
