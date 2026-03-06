import styles from '../styles/Loader.module.scss';

export default function Loader() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner} />
    </div>
  );
}
