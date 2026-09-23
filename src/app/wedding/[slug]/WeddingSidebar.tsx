'use client';

import {useState} from 'react';
import Link from 'next/link';
import styles from './dashboard.module.scss';

const nav=[['home','⌂','Home'],['schedule','▣','Schedule'],['events','✦','Events'],['travel','▤','Travel'],['menu','♨','Menu'],['music','♫','Music'],['photos','▧','Photos'],['guests','♧','Guests'],['singles','♡','Singles'],['live','♢','Live'],['invite','✉','Invitation']] as const;

export default function WeddingSidebar({base,active,showOrganiser=true,organiser=false,onToggleOrganiser}:{base:string;active:string;showOrganiser?:boolean;organiser?:boolean;onToggleOrganiser?:()=>void}){
 const[mobileMenuOpen,setMobileMenuOpen]=useState(false);
 return <aside className={`${styles.sidebar} ${mobileMenuOpen?styles.mobileMenuOpen:''}`}>
  <div className={styles.mobileHeader}>
   <Link href={base} className={styles.logo} onClick={()=>setMobileMenuOpen(false)}>MILNI<small>PEOPLE · TRADITIONS · TOGETHER</small></Link>
   <button className={styles.menuToggle} type="button" aria-label={mobileMenuOpen?'Close navigation':'Open navigation'} aria-expanded={mobileMenuOpen} onClick={()=>setMobileMenuOpen(open=>!open)}><span/><span/><span/></button>
  </div>
  <div className={styles.mobileMenuPanel} data-open={mobileMenuOpen?'true':'false'}>
   <nav>{nav.map(([key,icon,label])=><Link key={key} className={active===key?styles.active:''} href={key==='home'?base:`${base}/${key}`} onClick={()=>setMobileMenuOpen(false)}>{icon}<span>{label}</span></Link>)}</nav>
   {showOrganiser&&onToggleOrganiser&&<button className={styles.organiserToggle} onClick={()=>{onToggleOrganiser();setMobileMenuOpen(false)}}>{organiser?'✓ Organiser mode':'⚙ Organiser mode'}</button>}
   <div className={styles.sideQuote}>Good<br/>People<br/>Great<br/>Celebrations</div>
  </div>
 </aside>;
}
