import Link from 'next/link';
import styles from './page.module.scss';

const traditions = [
  ['Punjabi Sikh','Anand Karaj, Milni, Jaggo and Punjabi celebrations','☬'],
  ['Gujarati Hindu','Garba, Pithi, Mandap and Hindu wedding traditions','✦'],
  ['South Indian','Regional ceremonies and South Indian traditions','❋'],
  ['Muslim','Nikah, Mehndi, Walima and related celebrations','☾'],
  ['Mixed traditions','Bring two or more family traditions together','♡'],
  ['Other / Custom','Build your wedding completely from scratch','✎'],
];

export default function TraditionsPage(){
  return <main className={styles.page}>
    <header><Link href="/">MILNI <small>PEOPLE · TRADITIONS · TOGETHER</small></Link><span>Organiser setup</span></header>
    <section className={styles.content}>
      <p className={styles.step}>STEP 2 OF 4</p>
      <h1>What kind of wedding are you planning?</h1>
      <p className={styles.lead}>Choose any that apply. This only gives you a useful starting point. Every ceremony, explanation and timing remains yours to change.</p>
      <div className={styles.grid}>
        {traditions.map(([name,description,icon])=><label className={styles.card} key={name}>
          <input type="checkbox" name="tradition" value={name}/><span className={styles.icon}>{icon}</span><strong>{name}</strong><small>{description}</small><span className={styles.check}>✓</span>
        </label>)}
      </div>
      <div className={styles.message}><strong>No cultural assumptions baked in.</strong><span>MILNI uses traditions as editable suggestions, not rules. Add, remove, rename or rewrite anything in the schedule.</span></div>
      <footer><Link href="/create">← Wedding details</Link><Link href="/create/schedule">Build my schedule →</Link></footer>
    </section>
  </main>
}
