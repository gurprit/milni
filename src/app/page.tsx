import styles from './page.module.scss';

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.lotus}>♢</span>
          <strong>MILNI</strong>
          <small>PEOPLE · TRADITIONS · TOGETHER</small>
        </div>
        <a href="/create">Create your wedding</a>
      </nav>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>YOUR WEDDING · IN ONE PLACE</p>
          <h1>Different families.<br />One beautiful story.</h1>
          <p className={styles.intro}>
            Plan every event, keep every guest informed and bring everyone together in a private wedding space built around your traditions.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/create">Start planning →</a>
            <a className={styles.secondary} href="/join">Join a wedding</a>
          </div>
        </div>
        <aside className={styles.card}>
          <span>THE WEDDING WEEKEND</span>
          <h2>Everything your guests need, without the group-chat archaeology.</h2>
          <div className={styles.features}>
            <p>Schedule & ceremonies</p><p>Travel & coaches</p><p>Live updates</p><p>Menus & dietary info</p><p>Song requests</p><p>Shared memories</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
