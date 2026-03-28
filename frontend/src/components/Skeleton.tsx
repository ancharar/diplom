import styles from '../styles/Skeleton.module.scss';

interface SkeletonProps {
  rows?: number;
  height?: number;
}

export default function Skeleton({ rows = 3, height = 18 }: SkeletonProps) {
  return (
    <div className={styles.wrapper}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={styles.line}
          style={{
            height,
            width: i === rows - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <table>
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}><div className={styles.line} style={{ height: 14, width: '70%' }} /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><div className={styles.line} style={{ height: 14 }} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
