'use client';

import {ReactNode,useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {DRAFT_KEY,WeddingDraft,emptyDraft} from '../../../lib/weddingDraft';

export default function WeddingLayout({children}:{children:ReactNode}){
 const params=useParams();
 const[ready,setReady]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  const slug=String(params.slug||'our-wedding');
  (async()=>{
   try{
    let local:WeddingDraft=emptyDraft;
    try{local={...emptyDraft,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}}catch{}
    const response=await fetch(`/api/weddings/${encodeURIComponent(slug)}`,{cache:'no-store'});
    if(response.ok){
     const result=await response.json();
     if(result.ok&&result.draft){
      const shared=result.draft as Partial<WeddingDraft>;
      const merged:WeddingDraft={...local,...shared,traditions:local.traditions??[],songs:local.songs??[],songArchives:local.songArchives??[],photos:local.photos??[],travel:local.travel??[],venue:local.venue,menus:local.menus??[],updates:local.updates??[],singles:local.singles};
      localStorage.setItem(DRAFT_KEY,JSON.stringify(merged));
     }
    }
   }catch{}
   finally{if(!cancelled)setReady(true)}
  })();
  return()=>{cancelled=true};
 },[params.slug]);
 if(!ready)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f7f2e9',color:'#0d493f',fontFamily:'Georgia,serif',letterSpacing:'.08em'}}>Loading wedding…</div>;
 return children;
}
