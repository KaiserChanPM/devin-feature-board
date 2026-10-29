import IdeaCard from './IdeaCard.jsx';

export default function IdeaList({ ideas, onVote, votingEnabled, adminEnabled, onStatusChange }) {
  if (ideas.length === 0) {
    return <p className="message">No ideas yet. Be the first to suggest a feature!</p>;
  }

  return (
    <ul className="idea-list" aria-label="Ideas">
      {ideas.map((idea) => (
        <li key={idea.id}>
          <IdeaCard idea={idea} onVote={onVote} votingEnabled={votingEnabled}
            adminEnabled={adminEnabled} onStatusChange={onStatusChange} />
        </li>
      ))}
    </ul>
  );
}
