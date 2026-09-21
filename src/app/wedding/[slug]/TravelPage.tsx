'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OrganiserLoginModal from './OrganiserLoginModal';
import { WeddingDraft, emptyDraft, formatDateRange, readWeddingDraft, writeWeddingDraft } from '../../../lib/weddingDraft';
import TravelManager from './TravelManager';
import styles from './dashboard.module.scss';

const VIEW_MODE_KEY='milni:view-mode';
const nav=[['home','⌂','Home'],['schedule','▣','Schedule'],['events','✦','Events'],['travel','▤','Travel'],['menu','♨','Menu'],['music','♫','Music'],['photos','▧','Photos'],['guests','♧','Guests'],['singles','♡','Singles'],['live','♢','Live']] as const;

export default function TravelPage(){
 const [draft,setDraft]=useState<WeddingDraft>(emptyDraft);
 const [organiser,setOrganiser]=useState(false);const [organiserAuthed,setOrganiserAuthed]=useState(false);const [showOrganiserLogin,setShowOrganiserLogin]=useState(false);const [showOrganiserLogin,setShowOrganiserLogin]=useState(false);
 const [modeReady,setModeReady]=useState(false);
 const params=useParams();
 useEffect(()=>{setDraft(readWeddingDraft());void fetch('/api/organiser-session',{cache:'no-store'}).then(r=>r.json()).then(x=>{const authed=!!x.organiser;setOrganiserAuthed(authed);setOrganiser(authed&&localStorage.getItem(VIEW_MODE_KEY)==='organiser');setModeReady(true)}).catch(()=>setModeReady(true))},[]);
 const setMode=(next:boolean)=>{if(next&&!organiserAuthed){setShowOrganiserLogin(true);return}setOrganiser(next);localStorage.setItem(VIEW_MODE_KEY,next?'organiser':'guest')};
 const save=(patch:Partial<WeddingDraft>)=>{setDraft(current=>({...current,...patch}));writeWeddingDraft(patch)};
 const slug=String(params.slug||'our-wedding');
 const base=`/wedding/${slug}`;
 const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join(' & ')||'Our Wedding';
 return <main className={styles.shell}><aside className={styles.sidebar}><Link href={base} className={styles.logo}>MILNI<small>PEOPLE · TRADITIONS · TOGETHER</small></Link><nav>{nav.map(([key,icon,label])=><Link key={key} className={key==='travel'?styles.active:''} href={key==='home'?base:`${base}/${key}`}>{icon}<span>{label}</span></Link>)}</nav>{modeReady&&<button className={styles.organiserToggle} onClick={()=>setMode(!organiser)}>{organiser?'✓ Organiser mode':'⚙ Organiser mode'}</button>}<div className={styles.sideQuote}>Good<br/>People<br/>Great<br/>Celebrations</div></aside><section className={styles.content}>{modeReady&&organiser&&<div className={styles.organiserBar}><strong>Organiser mode</strong><span>You’re editing the wedding. Changes on this prototype are saved in this browser.</span><button onClick={()=>setMode(false)}>Preview as guest</button></div>}<header className={styles.pageHero}><div><small>{names.toUpperCase()}</small><h1>Travel & coaches</h1><p>{formatDateRange(draft.startDate,draft.endDate)} · {draft.city||'Location to be confirmed'}</p></div><Link href={base}>← Wedding home</Link></header><div className={styles.pageBody}><TravelManager draft={draft} save={save} organiser={organiser}/></div></section>{showOrganiserLogin&&<OrganiserLoginModal onClose={()=>setShowOrganiserLogin(false)} onSuccess={()=>{setOrganiserAuthed(true);setShowOrganiserLogin(false);setOrganiser(true);localStorage.setItem(VIEW_MODE_KEY,'organiser')}}/>}</main>;
}
