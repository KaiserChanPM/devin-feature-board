import { useEffect, useState } from 'react';
import { fetchIdeas } from './api.js';
import Header from './components/Header.jsx';
import IdeaList from './components/IdeaList.jsx';

export default function App() {
  const [ideas, setIdeas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    fetchIdeas()
      .then((data) => !ignore && setIdeas(data))
      .catch((err) => !ignore && setError(err.message));
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <Header />
      <main className="container">
        {error ? (
          <p className="message message--error" role="alert">
            Couldn't load ideas: {error}
          </p>
        ) : ideas === null ? (
          <p className="message">Loading ideas…</p>
        ) : (
          <IdeaList ideas={ideas} />
        )}
      </main>
    </>
  );
}
