import styles from '../styles/StatusBadge.module.scss';

const STATUS_COLORS: Record<string, string> = {
  // Новая
  new: 'gray',

  // Планируется
  todo: 'yellow',

  // В процессе
  on_discussion: 'yellow',
  approved: 'yellow',
  in_progress: 'yellow',
  testing: 'yellow',
  to_review: 'yellow',

  // Выполнена
  done: 'green',
  complete: 'green',
  ready_to_merge: 'green',
  closed: 'green',

  // Отклонена
  disapproved: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',

  todo: 'Todo',

  on_discussion: 'On discussion',
  approved: 'Approved',
  in_progress: 'In progress',

  testing: 'Testing',
  to_review: 'To review',

  done: 'Done',
  complete: 'Complete',
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