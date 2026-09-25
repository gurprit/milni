'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import QRCode from 'qrcode';
import InvitationManager from './InvitationManager';
import OrganiserLoginModal from '../OrganiserLoginModal';
import WeddingSidebar from '../WeddingSidebar';
import {invitationCode,WeddingDraft,emptyDraft,formatDateRange} from '../../../../lib/weddingDraft';
import dashboard from '../dashboard.module.scss';
import styles from './page.module.scss';

const VIEW_MODE_KEY='milni:view-mode';
const nav=[['home','⌂','Home'],['schedule','▣','Schedule'],['events','✦','Events'],['travel','▤','Travel'],['menu','♨','Menu'],['music','♫','Music'],['photos','▧','Photos'],['guests','♧','Guests'],['singles','♡','Singles'],['live','♢','Live'],['invite','✉','Invitation']] as const;
type Guest={id:string;name:string;weddingSlug:string;group:string;status:string;side:string;dietary:string;plusOne:string;inviteLink:string|null};

export default function InvitationPage(){
 const params=useParams();const slug=String(params.slug||'our-wedding');const base=`/wedding/${slug}`;
 const[draft,setDraft]=useState<WeddingDraft>(emptyDraft);const[guest,setGuest]=useState<Guest|null>(null);const[organiser,setOrganiser]=useState(false);const[organiserAuthed,setOrganiserAuthed]=useState(false);const[ready,setReady]=useState(false);const[showLogin,setShowLogin]=useState(false);const[qr,setQr]=useState('');
 useEffect(()=>{Promise.all([fetch(`/api/weddings/${encodeURIComponent(slug)}`,{cache:'no-store'}).then(r=>r.json()),fetch('/api/guest-session',{cache:'no-store'}).then(r=>r.json()),fetch('/api/organiser-session',{cache:'no-store'}).then(r=>r.json())]).then(([w,g,o])=>{if(w.ok&&w.draft)setDraft(w.draft);setGuest(g.guest?.weddingSlug===slug?g.guest:null);const authed=!!o.organiser;setOrganiserAuthed(authed);setOrganiser(authed&&localStorage.getItem(VIEW_MODE_KEY)==='organiser')}).finally(()=>setReady(true))},[slug]);
 useEffect(()=>{if(!guest?.inviteLink){setQr('');return}QRCode.toDataURL(guest.inviteLink,{width:700,margin:2,errorCorrectionLevel:'H'}).then(setQr).catch(()=>setQr(''))},[guest?.inviteLink]);
 const setMode=(next:boolean)=>{if(next&&!organiserAuthed){setShowLogin(true);return}setOrganiser(next);localStorage.setItem(VIEW_MODE_KEY,next?'organiser':'guest')};
 const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join(' & ')||'Our Wedding';const code=invitationCode(draft);
 const copy=async()=>{if(guest?.inviteLink)await navigator.clipboard.writeText(guest.inviteLink)};
 return <main className={dashboard.shell}><WeddingSidebar base={base} active="invite" showOrganiser={ready} organiser={organiser} onToggleOrganiser={()=>setMode(!organiser)}/><section className={dashboard.content}>{ready&&organiser&&<div className={dashboard.organiserBar}><strong>Organiser mode</strong><span>Manage guest invitation links, QR codes and fallback access.</span><button onClick={()=>setMode(false)}>Preview as guest</button></div>}<header className={dashboard.pageHero}><div><small>{names.toUpperCase()}</small><h1>{organiser?'Invitations':'Your invitation'}</h1><p>{formatDateRange(draft.startDate,draft.endDate)} · {draft.city||'Location to be confirmed'}</p></div><Link href={base}>← Wedding home</Link></header><div className={dashboard.pageBody}>{!ready?<section className={styles.loading}>Loading invitation…</section>:organiser?<InvitationManager/>:<GuestInvitation guest={guest} code={code} names={names} qr={qr} onCopy={copy}/>}</div></section>{showLogin&&<OrganiserLoginModal onClose={()=>setShowLogin(false)} onSuccess={()=>{setOrganiserAuthed(true);setShowLogin(false);setOrganiser(true);localStorage.setItem(VIEW_MODE_KEY,'organiser')}}/>}</main>
}

function GuestInvitation({guest,code,names,qr,onCopy}:{guest:Guest|null;code:string;names:string;qr:string;onCopy:()=>void}){
 if(!guest)return <section className={styles.guestInvite}><div className={styles.guestHero}><small>YOUR INVITATION</small><h2>Join {names}</h2><p>Open your personal invitation link, or use your email/mobile number and the wedding code to join this wedding.</p><Link href="/">Join a wedding →</Link></div><div className={styles.fallbackGuest}><span>Wedding code</span><strong>{code||'…'}</strong><small>Camera not playing nicely? This code plus your email address or mobile number is the trusty fallback.</small></div></section>;
 return <section className={styles.guestInvite}><div className={styles.guestHero}><small>YOU’RE INVITED</small><h2>Hi {guest.name.split(' ')[0]} ♡</h2><p>Your private invitation to {names}. Keep this page handy for your wedding details and access.</p><div className={styles.guestFacts}><div><span>RSVP</span><strong>{guest.status}</strong></div>{guest.group&&<div><span>WEDDING GROUP</span><strong>{guest.group}</strong></div>}{guest.dietary&&<div><span>DIETARY</span><strong>{guest.dietary}</strong></div>}{guest.plusOne&&<div><span>PLUS ONE / HOUSEHOLD</span><strong>{guest.plusOne}</strong></div>}</div></div><aside className={styles.accessCard}>{guest.inviteLink&&qr?<><small>YOUR PERSONAL QR</small><img src={qr} alt="Your personal wedding invitation QR code"/><p>Scanning this QR signs you straight into your wedding.</p><button onClick={onCopy}>Copy personal link</button></>:<><small>YOUR WEDDING CODE</small><strong className={styles.bigCode}>{code}</strong><p>Your current session is already signed in. If you need to join on another device, use the wedding code with your email address or mobile number.</p></>}<div className={styles.fallbackLine}><span>Fallback code</span><b>{code}</b></div><small className={styles.cameraFallback}>No camera or an older phone? The code + your email/mobile number always works from “Join a wedding”.</small></aside></section>
}
