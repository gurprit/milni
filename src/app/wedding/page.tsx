'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.scss';
import { WeddingDraft, emptyDraft, formatDateRange, readWeddingDraft } from '../../lib/weddingDraft';

export default function WeddingHome(){
 const [draft,setDraft]=useState<WeddingDraft>(emptyDraft);
 useEffect(()=>setDraft(readWeddingDraft()),[]);
 const events=useMemo(()=>draft.schedule?.flatMap((day,dayIndex)=>day.events.map(event=>({...event,day:day.date,dayIndex})))??[],[draft.schedule]);
 const next=events[0];
 const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join(' & ')||'Your Wedding';
 const title=draft.title||`${names}'s Wedding Weekend`;
 return <main className={styles.shell}>
  <aside className={styles.sidebar}><div className={styles.logo}>MILNI<small>PEOPLE · TRADITIONS · TOGETHER</small></div><nav><a className={styles.active}>⌂ <span>Home</span></a><a>▣ <span>Schedule</span></a><a>✦ <span>Events</span></a><a>▤ <span>Travel</span></a><a>♨ <span>Menu</span></a><a>♫ <span>Music</span></a><a>▧ <span>Photos</span></a><a>♧ <span>Guests</span></a><a>♡ <span>Singles</span></a><a>♢ <span>Live</span></a></nav><div className={styles.sideQuote}>Good<br/>People<br/>Great<br/>Celebrations</div></aside>
  <section className={styles.content}>
   <header className={styles.hero}><div><small>WELCOME TO</small><h1>{title}</h1><p>▣ {formatDateRange(draft.startDate,draft.endDate)} &nbsp; | &nbsp; ◇ {draft.city||'Location to be confirmed'}</p><blockquote>“Different families.<br/>Same beautiful story.”</blockquote></div><div className={styles.next}><small>NEXT UP</small><h2>{next?.name||'Your celebration'}</h2><p>{next?`${next.day} at ${next.start}`:'Add your first event'}</p><Link href="/create/schedule">View schedule →</Link></div></header>
   <div className={styles.quick}><Link href="/create/schedule"><b>◇</b><span>Wedding schedule<small>See what’s happening</small></span>→</Link><a><b>▤</b><span>Your coach<small>Travel & timings</small></span>→</a><a><b>♧</b><span>Guest list<small>Meet everyone</small></span>→</a><a><b>♨</b><span>Menus<small>Food & dietary info</small></span>→</a></div>
   <div className={styles.grid}><section className={styles.card}><div className={styles.cardHead}><h2>Wedding Schedule</h2><Link href="/create/schedule">Edit schedule →</Link></div>{(draft.schedule??[]).map(day=><div className={styles.day} key={day.id}><h3>{day.label} · {day.date}</h3>{day.events.map(event=><div className={styles.event} key={event.id}><time>{event.start}</time><i>{event.type==='Food'?'♨':event.type==='Travel'?'▤':'✦'}</i><span><b>{event.name}</b><small>{event.description}</small></span><em>›</em></div>)}</div>)}{!draft.schedule?.length&&<p>Your schedule is waiting to be built.</p>}</section>
   <aside className={styles.right}><section className={styles.card}><h2>Announcements</h2><div className={styles.notice}>🎉 <span>Welcome to {names}'s wedding space.</span></div><div className={styles.notice}>ℹ️ <span>Live wedding updates will appear here.</span></div></section><section className={`${styles.card} ${styles.welcome}`}><h2>♡ We’re so happy you’re here!</h2><p>This is your private place for the whole celebration. Keep everyone informed, involved and together.</p><small>{names}</small></section><section className={styles.tiles}><div><b>♫</b><h3>Song Requests</h3><p>Build the soundtrack together.</p></div><div><b>♡</b><h3>Singles</h3><p>Optional wedding-only matching.</p></div></section></aside></div>
  </section>
 </main>
}
