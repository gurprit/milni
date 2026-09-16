import Link from 'next/link';
import styles from './page.module.scss';

const steps = ['Wedding details', 'Traditions', 'Schedule', 'Invite'];

export default function CreateWeddingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>MILNI <small>PEOPLE · TRADITIONS · TOGETHER</small></Link>
        <span>Organiser setup</span>
      </header>

      <div className={styles.shell}>
        <aside className={styles.intro}>
          <p className={styles.eyebrow}>A NEW CHAPTER TOGETHER</p>
          <h1>Create your wedding</h1>
          <p>Start with the essentials. You can change everything later as plans evolve.</p>
          <blockquote>“Your traditions. Your people. Your celebration.”</blockquote>
        </aside>

        <section className={styles.panel}>
          <nav className={styles.progress} aria-label="Wedding setup progress">
            {steps.map((step, index) => (
              <div className={index === 0 ? styles.activeStep : styles.step} key={step}>
                <span>{index + 1}</span><small>{step}</small>
              </div>
            ))}
          </nav>

          <div className={styles.formHeading}>
            <p>STEP 1 OF 4</p>
            <h2>Tell us about your wedding</h2>
            <span>Just enough to give your wedding space a name, place and shape.</span>
          </div>

          <form className={styles.form} action="/create/traditions">
            <div className={styles.names}>
              <label>Your name<input name="partnerOne" placeholder="e.g. Simran" required /></label>
              <label>Partner's name<input name="partnerTwo" placeholder="e.g. Raj" required /></label>
            </div>
            <label>Wedding location<input name="city" placeholder="City or main location, e.g. London" required /></label>
            <div className={styles.names}>
              <label>Wedding starts<input name="startDate" type="date" required /></label>
              <label>Wedding ends<input name="endDate" type="date" required /></label>
            </div>
            <label>Wedding name <small>Optional</small><input name="title" placeholder="Simran & Raj's Wedding Weekend" /></label>

            <div className={styles.note}>🌿 Indian weddings rarely fit neatly into a single template. Next, you'll choose the traditions and ceremonies that are relevant to your families.</div>

            <div className={styles.actions}>
              <Link href="/">← Back</Link>
              <button type="submit">Choose traditions →</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
