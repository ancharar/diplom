import styles from '../styles/StatusBadge.module.scss';

const STATUS_COLORS: Record<string, string> = {
  new: 'gray',
  on_discussion: 'orange',
  approved: 'blue',
  in_progress: 'blue',
  complete: 'teal',
  testing: 'purple',
  to_review: 'purple',
  ready_to_merge: 'green',
  closed: 'green',
  disapproved: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  on_discussion: 'On discussion',
  approved: 'Approved',
  in_progress: 'In progress',
  complete: 'Complete',
  testing: 'Testing',
  to_review: 'To review',
  ready_to_merge: 'Ready to merge',
  closed: 'Closed',
  disapproved: 'Disapproved',
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || 'gray';
  return (
    <span className={`${styles.badge} ${styles[color]}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
