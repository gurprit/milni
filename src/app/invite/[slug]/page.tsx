'use client';
import {FormEvent,useEffect,useState} from 'react';
import {useParams,useRouter,useSearchParams} from 'next/navigation';
import styles from './page.module.scss';

type Wedding={partnerOne:string;partnerTwo:string;title:string;city:string;startDate:string;endDate:string;inviteHeroUrl?:string};
const RECENT_WEDDING_KEY='milni:recent-wedding';

export default function InvitationPage(){
 const params=useParams();const router=useRouter();const search=useSearchParams();const slug=String(params.slug||'');
 const[wedding,setWedding]=useState<Wedding|null>(null);const[contact,setContact]=useState('');const[code,setCode]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);

 useEffect(()=>{
  try{const remembered=JSON.parse(localStorage.getItem(RECENT_WEDDING_KEY)||'null') as {slug?:string;code?:string}|null;if(remembered?.slug===slug&&remembered.code)setCode(remembered.code)}catch{}
  const token=search.get('token');
  if(token){
   setBusy(true);
   fetch('/api/guest-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})})
    .then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||'Could not open invitation.');router.replace(`/wedding/${x.weddingSlug}`)})
    .catch(e=>setError(e instanceof Error?e.message:'Could not open invitation.'))
    .finally(()=>setBusy(false));
  }
  fetch(`/api/weddings/${encodeURIComponent(slug)}`,{cache:'no-store'}).then(r=>r.json()).then(r=>{if(r.ok)setWedding(r.draft)}).catch(()=>{});
 },[slug,search,router]);

 const remember=(weddingSlug:string)=>{try{localStorage.setItem(RECENT_WEDDING_KEY,JSON.stringify({slug:weddingSlug,code:code.trim().toUpperCase()}))}catch{}};

 const join=async()=>{
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/guest-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug,contact,code})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Could not join wedding.');
   remember(result.weddingSlug||slug);router.push(`/wedding/${result.weddingSlug||slug}`);
  }catch(err){setError(err instanceof Error?err.message:'Could not join wedding.')}finally{setBusy(false)}
 };
 const submit=(e:FormEvent)=>{e.preventDefault();void join()};
 const names=wedding?[wedding.partnerOne,wedding.partnerTwo].filter(Boolean).join(' & '):'Our wedding';
 const hero=wedding?.inviteHeroUrl?{backgroundImage:`linear-gradient(rgba(6,31,27,.25),rgba(6,31,27,.78)),url("${wedding.inviteHeroUrl}")`}:undefined;

 return <main className={styles.page}><section className={styles.card}><div className={styles.hero} style={hero}><span>MILNI</span><small>YOU'RE INVITED TO</small><h1>{names}</h1><p>{wedding?.title||'WEDDING WEEKEND'}</p></div><form onSubmit={submit}><span>PRIVATE WEDDING INVITATION</span><h2>You’re invited!</h2><p>Enter the wedding code from your invitation and the email address or mobile number the couple has for you.</p><label>Email or mobile number<input autoFocus value={contact} onChange={e=>{setContact(e.target.value)}} placeholder="you@example.com or 07123 456789" required/></label><label>Wedding code<input value={code} onChange={e=>{setCode(e.target.value.toUpperCase())}} placeholder="Wedding code" required/></label>{error&&<div className={styles.error}>{error}</div>}<button disabled={busy||!contact.trim()||!code.trim()}>{busy?'Checking invitation…':'Join our wedding →'}</button><small className={styles.private}>🔒 We remember the wedding code on this browser, not your email or phone number.</small></form></section></main>;
}
