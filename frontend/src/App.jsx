import { useCallback, useEffect, useRef, useState } from 'react';
import { changeVote, fetchIdeas } from './api.js';
import { getVisitorIdentity } from './visitorId.js';
import Header from './components/Header.jsx';
import IdeaList from './components/IdeaList.jsx';
import SuggestForm from './components/SuggestForm.jsx';

export default function App() {
  const [ideas, setIdeas] = useState(null);
  const [error, setError] = useState(null);
  const requestVersion = useRef(0);
  const [identity] = useState(getVisitorIdentity);

  const loadIdeas = useCallback(async (isCurrent = () => true) => {
    const version = ++requestVersion.current;
    try {
      const data = await fetchIdeas();
      if (!isCurrent() || version !== requestVersion.current) return;
      setIdeas(data);
      setError(null);
    } catch (err) {
      if (isCurrent() && version === requestVersion.current) setError(err.message);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    loadIdeas(() => !ignore);
    return () => {
      ignore = true;
    };
  }, [loadIdeas]);

  async function handleVote(idea) {
    ++requestVersion.current;
    try {
      const updated = await changeVote(idea.id, idea.hasVoted);
      ++requestVersion.current;
      setIdeas((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      await loadIdeas();
      throw err;
    }
    await loadIdeas();
  }

  return (
    <>
      <Header />
      <main className="container">
        <SuggestForm onCreated={() => loadIdeas()} />
        {identity.error && (
          <p className="message message--error" role="alert">{identity.error}</p>
        )}
        {error && (
          <p className="message message--error" role="alert">
            Couldn't load ideas: {error}
            {' '}
            <button className="button" onClick={() => loadIdeas()}>Retry</button>
          </p>
        )}
        {ideas === null ? (
          !error && <p className="message">Loading ideas…</p>
        ) : (
          <IdeaList ideas={ideas} onVote={handleVote} votingEnabled={Boolean(identity.id)} />
        )}
      </main>
    </>
  );
}
