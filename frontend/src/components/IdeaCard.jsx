import StatusBadge from './StatusBadge.jsx';

export default function IdeaCard({ idea }) {
  const votesLabel = `${idea.voteCount} ${idea.voteCount === 1 ? 'vote' : 'votes'}`;

  return (
    <article className="idea-card">
      <div className="idea-card__votes" aria-label={votesLabel}>
        <span className="idea-card__vote-count">{idea.voteCount}</span>
        <span className="idea-card__vote-label" aria-hidden="true">
          {idea.voteCount === 1 ? 'vote' : 'votes'}
        </span>
      </div>
      <div className="idea-card__body">
        <div className="idea-card__heading">
          <h2 className="idea-card__title">{idea.title}</h2>
          <StatusBadge status={idea.status} />
        </div>
        {idea.description && <p className="idea-card__description">{idea.description}</p>}
      </div>
    </article>
  );
}
