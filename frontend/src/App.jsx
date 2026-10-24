import { useCallback, useEffect, useState } from 'react';
import { fetchIdeas } from './api.js';
import Header from './components/Header.jsx';
import IdeaList from './components/IdeaList.jsx';
import SuggestForm from './components/SuggestForm.jsx';

export default function App() {
  const [ideas, setIdeas] = useState(null);
  const [error, setError] = useState(null);

  const loadIdeas = useCallback(async (isCurrent = () => true) => {
    try {
      const data = await fetchIdeas();
      if (!isCurrent()) return;
      setIdeas(data);
      setError(null);
    } catch (err) {
      if (isCurrent()) setError(err.message);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    loadIdeas(() => !ignore);
    return () => {
      ignore = true;
    };
  }, [loadIdeas]);

  return (
    <>
      <Header />
      <main className="container">
        <SuggestForm onCreated={() => loadIdeas()} />
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
