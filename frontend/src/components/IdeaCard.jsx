import { useRef, useState } from 'react';
import StatusBadge from './StatusBadge.jsx';
import { allowedStatuses } from '../../../shared/statusRules.js';
import { STATUS_LABELS } from '../status.js';

export default function IdeaCard({ idea, onVote, votingEnabled, adminEnabled, onStatusChange }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const votesLabel = `${idea.voteCount} ${idea.voteCount === 1 ? 'vote' : 'votes'}`;
  const shipped = idea.status === 'shipped';
  const errorId = `idea-error-${idea.id}`;

  async function mutate(action, label) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(`Couldn't save ${label}: ${err.message}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <article className="idea-card">
      <div className="idea-card__voting">
        <div className="idea-card__votes" aria-label={votesLabel}>
          <span className="idea-card__vote-count">{idea.voteCount}</span>
          <span className="idea-card__vote-label" aria-hidden="true">
            {idea.voteCount === 1 ? 'vote' : 'votes'}
          </span>
        </div>
        <button
          type="button"
          className={`button idea-card__vote-button${idea.hasVoted ? ' idea-card__vote-button--voted' : ''}`}
          aria-label={`${idea.hasVoted ? 'Remove vote from' : 'Vote for'} ${idea.title}`}
          aria-pressed={Boolean(idea.hasVoted)}
          aria-busy={pending}
          aria-describedby={error ? errorId : undefined}
          disabled={shipped || pending || !votingEnabled}
          title={shipped ? 'Shipped ideas are closed to voting' : undefined}
          onClick={() => mutate(() => onVote(idea), 'your vote')}
        >
          {pending ? 'Saving…' : idea.hasVoted ? 'Unvote' : 'Vote'}
        </button>
      </div>
      <div className="idea-card__body">
        <div className="idea-card__heading">
          <h2 className="idea-card__title">{idea.title}</h2>
          <StatusBadge status={idea.status} />
        </div>
        {idea.description && <p className="idea-card__description">{idea.description}</p>}
        {idea.hasVoted && <p className="idea-card__voted">You voted</p>}
        {shipped && <p className="idea-card__closed">Voting closed</p>}
        {adminEnabled && allowedStatuses(idea.status).length > 0 && (
          <div className="admin-actions idea-card__statuses" role="group" aria-label={`Change status of ${idea.title}`}>
            {allowedStatuses(idea.status).map((status) => (
              <button key={status} type="button" className="button" disabled={pending}
                aria-busy={pending} aria-describedby={error ? errorId : undefined}
                onClick={() => mutate(() => onStatusChange(idea, status), 'status')}>
                Move to {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        )}
        {error && (
          <p id={errorId} className="form-message form-message--error" role="alert">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
