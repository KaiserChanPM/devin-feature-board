import { STATUS_LABELS } from '../status.js';

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}
