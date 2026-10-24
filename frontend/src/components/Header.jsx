export default function Header() {
  return (
    <header className="header">
      <div className="container header__inner">
        <h1 className="header__title">Feature Request Board</h1>
        <button type="button" className="button" disabled title="Admin mode is coming soon">
          Admin
        </button>
      </div>
    </header>
  );
}
