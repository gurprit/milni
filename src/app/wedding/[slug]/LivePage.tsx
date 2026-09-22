'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OrganiserLoginModal from './OrganiserLoginModal';
import { WeddingDraft, emptyDraft, formatDateRange, readWeddingDraft } from '../../../lib/weddingDraft';
import dashboard from './dashboard.module.scss';
import styles from './live.module.scss';

type LiveUpdate={id:string;title:string;message:string;kind:'update'|'urgent';created_at:string};
const VIEW_MODE_KEY='milni:view-mode';
const nav=[['home','⌂','Home'],['schedule','▣','Schedule'],['events','✦','Events'],['travel','▤','Travel'],['menu','♨','Menu'],['music','♫','Music'],['photos','▧','Photos'],['guests','♧','Guests'],['singles','♡','Singles'],['live','♢','Live'],['invite','✉','Invitation']] as const;

function timeLabel(value:string){
 const date=new Date(value); if(Number.isNaN(date.getTime()))return '';
 return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(date);
}
function dayLabel(value:string){
 const date=new Date(value); if(Number.isNaN(date.getTime()))return '';
 const today=new Date(); const yesterday=new Date(); yesterday.setDate(today.getDate()-1);
 if(date.toDateString()===today.toDateString())return 'Today';
 if(date.toDateString()===yesterday.toDateString())return 'Yesterday';
 return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(date);
}

export default function LivePage(){
 const params=useParams(); const slug=String(params.slug||'');
 const [draft,setDraft]=useState<WeddingDraft>(emptyDraft); const [updates,setUpdates]=useState<LiveUpdate[]>([]); const [organiser,setOrganiser]=useState(false); const [organiserAuthed,setOrganiserAuthed]=useState(false); const [showOrganiserLogin,setShowOrganiserLogin]=useState(false); const [modeReady,setModeReady]=useState(false);
 const [title,setTitle]=useState(''); const [message,setMessage]=useState(''); const [urgent,setUrgent]=useState(false);
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState('');

 const load=useCallback(async(silent=false)=>{try{const r=await fetch(`/api/live-updates/${encodeURIComponent(slug)}`,{cache:'no-store'});const x=await r.json();if(r.ok)setUpdates(x.updates??[]);else if(!silent)setError(x.error||'Could not load updates')}catch{if(!silent)setError('Could not load updates')}finally{if(!silent)setLoading(false)}},[slug]);
 useEffect(()=>{setDraft(readWeddingDraft());fetch('/api/organiser-session',{cache:'no-store'}).then(r=>r.json()).then(x=>{const authed=!!x.organiser;setOrganiserAuthed(authed);setOrganiser(authed&&localStorage.getItem(VIEW_MODE_KEY)==='organiser');setModeReady(true)}).catch(()=>setModeReady(true));load();const timer=window.setInterval(()=>load(true),5000);return()=>window.clearInterval(timer)},[load]);
 const setMode=(next:boolean)=>{if(next&&!organiserAuthed){setShowOrganiserLogin(true);return}setOrganiser(next);localStorage.setItem(VIEW_MODE_KEY,next?'organiser':'guest')};
 const base=`/wedding/${slug}`; const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join(' & ')||'Our Wedding';
 const post=async()=>{if(!title.trim()||!message.trim())return;setSaving(true);setError('');try{const r=await fetch(`/api/live-updates/${encodeURIComponent(slug)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,message,kind:urgent?'urgent':'update'})});const x=await r.json();if(!r.ok)throw new Error(x.error||'Could not post update');setUpdates(v=>[x.update,...v]);setTitle('');setMessage('');setUrgent(false)}catch(e){setError(e instanceof Error?e.message:'Could not post update')}finally{setSaving(false)}};
 const remove=async(id:string)=>{if(!confirm('Remove this update?'))return;const r=await fetch(`/api/live-updates/${encodeURIComponent(slug)}`,{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id})});if(r.ok)setUpdates(v=>v.filter(u=>u.id!==id))};

 return <main className={dashboard.shell}><aside className={dashboard.sidebar}><Link href={base} className={dashboard.logo}>MILNI<small>PEOPLE · TRADITIONS · TOGETHER</small></Link><nav>{nav.map(([key,icon,label])=><Link key={key} className={key==='live'?dashboard.active:''} href={key==='home'?base:`${base}/${key}`}>{icon}<span>{label}</span></Link>)}</nav>{modeReady&&<button className={dashboard.organiserToggle} onClick={()=>setMode(!organiser)}>{organiser?'✓ Organiser mode':'⚙ Organiser mode'}</button>}<div className={dashboard.sideQuote}>Good<br/>People<br/>Great<br/>Celebrations</div></aside><section className={dashboard.content}>{modeReady&&organiser&&<div className={dashboard.organiserBar}><strong>Organiser mode</strong><span>You’re editing the wedding.</span><button onClick={()=>setMode(false)}>Preview as guest</button></div>}<header className={dashboard.pageHero}><div><small>{names.toUpperCase()}</small><h1>Live updates</h1><p>{formatDateRange(draft.startDate,draft.endDate)} · {draft.city||'Location to be confirmed'}</p></div><Link href={base}>← Wedding home</Link></header><div className={dashboard.pageBody}><div className={styles.layout}>
  <section className={styles.feed}>
   <div className={styles.feedHeader}><div><span className={styles.liveDot}/> LIVE FROM THE WEDDING<h2>Wedding updates</h2><p>Timings, travel changes and little things worth knowing, as they happen.</p></div><span className={styles.refresh}>Updates automatically</span></div>
   {loading?<div className={styles.empty}>Loading the latest…</div>:updates.length===0?<div className={styles.empty}><b>All quiet for now.</b><span>When the organisers post an update, it will appear here automatically.</span></div>:<div className={styles.timeline}>{updates.map((u,index)=><article key={u.id} className={u.kind==='urgent'?styles.urgent:''}><div className={styles.when}><strong>{timeLabel(u.created_at)}</strong><span>{dayLabel(u.created_at)}</span></div><div className={styles.marker}><i/></div><div className={styles.updateBody}>{u.kind==='urgent'&&<small>IMPORTANT UPDATE</small>}<h3>{u.title}</h3><p>{u.message}</p>{organiser&&<button onClick={()=>remove(u.id)}>Remove</button>}</div>{index===0&&<span className={styles.latest}>LATEST</span>}</article>)}</div>}
  </section>
  <aside className={styles.side}>
   {organiser?<section className={styles.composer}><div className={styles.eyebrow}>ORGANISER</div><h2>Post an update</h2><p>Guests with this wedding open will see new posts within a few seconds.</p><label>Headline<input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Coach leaving in 10 minutes"/></label><label>Message<textarea maxLength={1000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Add the useful details…"/></label><label className={styles.urgentToggle}><input type="checkbox" checked={urgent} onChange={e=>setUrgent(e.target.checked)}/><span><b>Mark as important</b><small>Highlights the update for guests.</small></span></label><button className={styles.postButton} disabled={saving||!title.trim()||!message.trim()} onClick={post}>{saving?'Posting…':'Post live update →'}</button>{error&&<div className={styles.error}>{error}</div>}</section>:<section className={styles.info}><div className={styles.eyebrow}>STAY IN THE LOOP</div><h2>No frantic group chat required.</h2><p>Keep this page handy during the celebrations. New messages from the organisers appear here automatically.</p><div><b>✦</b><span>Coach movements<br/><small>Departure times and changes</small></span></div><div><b>◇</b><span>Timing updates<br/><small>Know where to be and when</small></span></div><div><b>♡</b><span>Wedding moments<br/><small>Photos, dancing and surprises</small></span></div></section>}
  </aside>
 </div></div></section>{showOrganiserLogin&&<OrganiserLoginModal onClose={()=>setShowOrganiserLogin(false)} onSuccess={()=>{setOrganiserAuthed(true);setShowOrganiserLogin(false);setOrganiser(true);localStorage.setItem(VIEW_MODE_KEY,'organiser')}}/>}</main>;
}
