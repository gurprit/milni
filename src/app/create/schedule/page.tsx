import Link from 'next/link';
import styles from './page.module.scss';

const days = [
  { label: 'Day 1', date: 'Thursday', events: [
    ['11:00','12:30','Haldi','A joyful start with colour, blessings and plenty of smiles.','Celebration'],
    ['13:00','14:30','Lunch','Time to eat, catch up and settle into the weekend.','Food'],
    ['19:00','23:00','Sangeet','Music, dancing and performances with family and friends.','Celebration'],
  ]},
  { label: 'Day 2', date: 'Friday', events: [
    ['11:30','12:00','Baraat',"The groom's procession and arrival.",'Tradition'],
    ['12:15','12:45','Milni','A meeting and welcome between the families.','Tradition'],
    ['13:00','14:30','Anand Karaj','The Sikh wedding ceremony.','Ceremony'],
    ['19:30','00:30','Reception','Dinner, dancing and celebrations.','Celebration'],
  ]},
  { label: 'Day 3', date: 'Saturday', events: [
    ['11:00','13:00','Farewell brunch','One last meal together before everyone heads home.','Food'],
  ]},
];

export default function SchedulePage(){
  return <main className={styles.page}>
    <header><Link href="/">MILNI <small>PEOPLE · TRADITIONS · TOGETHER</small></Link><span>Organiser setup</span></header>
    <section className={styles.content}>
      <div className={styles.heading}>
        <div><p>STEP 3 OF 4</p><h1>Build your schedule</h1><span>We’ve suggested a starting point. Now make it yours.</span></div>
        <button>＋ Add event</button>
      </div>
      <div className={styles.tip}><strong>A starting point, not a prescription.</strong><span>These events are suggestions based on the traditions you selected. Rename, reorder, remove or add anything your families need.</span></div>
      <div className={styles.workspace}>
        <section className={styles.schedule}>
          {days.map((day, dayIndex)=><article className={styles.day} key={day.label}>
            <div className={styles.dayTitle}><div><small>{day.label}</small><h2>{day.date}</h2></div><button>＋ Add to day</button></div>
            <div className={styles.events}>
              {day.events.map(([start,end,name,description,type], index)=><div className={styles.event} key={name}>
                <span className={styles.grab}>⠿</span>
                <div className={styles.time}><strong>{start}</strong><small>{end}</small></div>
                <div className={styles.marker}>{type === 'Food' ? '♨' : type === 'Ceremony' ? '♡' : type === 'Tradition' ? '✦' : '♫'}</div>
                <div className={styles.eventCopy}><div><h3>{name}</h3><span>{type}</span></div><p>{description}</p></div>
                <button className={styles.edit}>Edit</button><button className={styles.more}>•••</button>
              </div>)}
            </div>
            {dayIndex < days.length - 1 && <div className={styles.connector}>↓</div>}
          </article>)}
        </section>
        <aside className={styles.summary}>
          <small>YOUR WEDDING WEEKEND</small><h2>3 days.<br/>8 moments.</h2>
          <dl><div><dt>Traditions</dt><dd>Punjabi Sikh</dd></div><div><dt>First event</dt><dd>Haldi · 11:00</dd></div><div><dt>Final event</dt><dd>Farewell brunch</dd></div></dl>
          <div className={styles.custom}><strong>Something missing?</strong><p>Every wedding is different. Add ceremonies, family events, meals, travel or anything else.</p><button>＋ Add custom event</button></div>
        </aside>
      </div>
      <footer><Link href="/create/traditions">← Traditions</Link><Link className={styles.continue} href="/create/invite">Looks good — invite guests →</Link></footer>
    </section>
  </main>
}
