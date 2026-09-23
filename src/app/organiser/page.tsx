'use client';

import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';

type Wedding={slug:string;partner_one:string;partner_two:string;title:string|null;city:string|null;start_date:string|null;end_date:string|null;role:string};

export default function OrganiserHome(){
 const router=useRouter();const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[weddings,setWeddings]=useState<Wedding[]|null>(null);const[organiserEmail,setOrganiserEmail]=useState('');

 const load=async()=>{const r=await fetch('/api/organiser-weddings',{cache:'no-store'});const x=await r.json();if(!r.ok){setWeddings(null);return false}setOrganiserEmail(x.organiser?.email||'');setWeddings(x.weddings||[]);return true};
 useEffect(()=>{void load()},[]);
 const login=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/organiser-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});const x=await r.json();if(!r.ok)throw new Error(x.error||'Could not sign in.');const ok=await load();if(!ok)throw new Error('Signed in, but no organiser weddings were found.')}catch(e){setError(e instanceof Error?e.message:'Could not sign in.')}finally{setBusy(false)}};
 const logout=async()=>{await fetch('/api/organiser-session',{method:'DELETE'});setWeddings(null);setOrganiserEmail('');setPassword('')};

 return <main className={styles.page}><header className={styles.header}><Link href="/" className={styles.brand}>MILNI<small>PEOPLE · TRADITIONS · TOGETHER</small></Link>{weddings&&<button onClick={logout}>Sign out</button>}</header><section className={styles.shell}>{weddings?<><div className={styles.heading}><p>ORGANISER HOME</p><h1>Your weddings</h1><span>{organiserEmail}</span></div>{weddings.length?<div className={styles.grid}>{weddings.map(w=>{const names=[w.partner_one,w.partner_two].filter(Boolean).join(' & ');return <Link href={`/wedding/${w.slug}`} key={w.slug} className={styles.card}><small>{w.role==='partner-one'?'PARTNER 1':'PARTNER 2'}</small><h2>{names||w.title||'Wedding'}</h2><p>{[w.start_date,w.city].filter(Boolean).join(' · ')||'Wedding details'}</p><span>Continue organising →</span></Link>})}</div>:<div className={styles.empty}><h2>No weddings yet</h2><p>Create a wedding and both partners will get organiser access.</p><Link href="/create">Create your wedding →</Link></div>}<div className={styles.actions}><Link href="/create">＋ Create another wedding</Link></div></>:<section className={styles.login}><p className={styles.eyebrow}>ORGANISER ACCESS</p><h1>Welcome back</h1><p>Sign in to open the weddings you organise.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{error&&<div className={styles.error}>{error}</div>}<button disabled={busy}>{busy?'Signing in…':'Sign in →'}</button></form><Link href="/create" className={styles.createLink}>New here? Create a wedding</Link></section>}</section></main>;
}
