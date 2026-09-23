'use client';

import {FormEvent,useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.scss';

type ClaimInfo={organiser:{name:string;email:string};wedding:{slug:string;partnerOne:string;partnerTwo:string}};

export default function OrganiserClaimPage(){
 const params=useParams();const router=useRouter();const token=String(params.token||'');
 const[info,setInfo]=useState<ClaimInfo|null>(null);const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{fetch(`/api/organiser-claim/${encodeURIComponent(token)}`,{cache:'no-store'}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error||'Could not load invitation.');setInfo(x)}).catch(e=>setError(e instanceof Error?e.message:'Could not load invitation.'))},[token]);
 const submit=async(e:FormEvent)=>{e.preventDefault();setError('');if(password!==confirm){setError('Passwords do not match.');return}setBusy(true);try{const r=await fetch(`/api/organiser-claim/${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});const x=await r.json();if(!r.ok)throw new Error(x.error||'Could not claim account.');router.push(`/wedding/${x.weddingSlug}`)}catch(e){setError(e instanceof Error?e.message:'Could not claim account.')}finally{setBusy(false)}};
 const names=info?[info.wedding.partnerOne,info.wedding.partnerTwo].filter(Boolean).join(' & '):'Your wedding';
 return <main className={styles.page}><section className={styles.card}><Link href="/" className={styles.brand}>MILNI<small>PEOPLE · TRADITIONS · TOGETHER</small></Link>{info?<><p className={styles.eyebrow}>ORGANISER INVITATION</p><h1>Welcome, {info.organiser.name}</h1><p>You’ve been invited to organise <strong>{names}</strong> together. Create your password and MILNI will sign you straight in.</p><div className={styles.email}>{info.organiser.email}</div><form onSubmit={submit}><label>Create password<input autoFocus type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required/><small>At least 8 characters.</small></label><label>Confirm password<input type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>{error&&<div className={styles.error}>{error}</div>}<button disabled={busy||password.length<8||confirm.length<8}>{busy?'Creating account…':'Join as organiser →'}</button></form></>:<div className={styles.loading}>{error||'Loading organiser invitation…'}</div>}</section></main>;
}
