'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.scss';
import { EventType, WeddingDay, WeddingEvent, readWeddingDraft, weddingSlug, writeWeddingDraft } from '../../../lib/weddingDraft';

const templates:Record<string,WeddingDay[]>={
'Punjabi Sikh':[
{id:'sikh-day-1',label:'Day 1',date:'Thursday',events:[
{id:'sikh-haldi',start:'11:00',end:'12:30',name:'Haldi',description:'A joyful pre-wedding gathering with turmeric, blessings and family.',type:'Tradition'},
{id:'sikh-sangeet',start:'19:00',end:'23:00',name:'Sangeet',description:'An evening of music, dancing and performances with family and friends.',type:'Celebration'}]},
{id:'sikh-day-2',label:'Day 2',date:'Friday',events:[
{id:'sikh-baraat',start:'09:30',end:'10:00',name:'Baraat',description:"The groom's wedding procession and arrival.",type:'Tradition'},
{id:'sikh-milni',start:'10:00',end:'10:30',name:'Milni',description:'A formal welcome and meeting between members of both families.',type:'Tradition'},
{id:'sikh-anand-karaj',start:'11:00',end:'13:00',name:'Anand Karaj',description:'The Sikh wedding ceremony at the Gurdwara.',type:'Ceremony'},
{id:'sikh-langar',start:'13:00',end:'14:30',name:'Langar',description:'A communal vegetarian meal following the ceremony.',type:'Food'},
{id:'sikh-reception',start:'19:00',end:'00:30',name:'Reception',description:'Dinner, speeches, music and dancing.',type:'Celebration'}]},
{id:'sikh-day-3',label:'Day 3',date:'Saturday',events:[{id:'sikh-brunch',start:'11:00',end:'13:00',name:'Farewell brunch',description:'A relaxed final meal with family and friends.',type:'Food'}]}],
'Gujarati Hindu':[
{id:'gujarati-day-1',label:'Day 1',date:'Thursday',events:[
{id:'gujarati-pithi',start:'11:00',end:'12:30',name:'Pithi',description:'A pre-wedding turmeric ceremony with family and blessings.',type:'Tradition'},
{id:'gujarati-garba',start:'19:00',end:'23:00',name:'Garba & Sangeet',description:'An evening of garba, music, dancing and family performances.',type:'Celebration'}]},
{id:'gujarati-day-2',label:'Day 2',date:'Friday',events:[
{id:'gujarati-baraat',start:'10:00',end:'10:45',name:'Baraat',description:"The groom's procession and arrival.",type:'Tradition'},
{id:'gujarati-mandap',start:'11:00',end:'13:00',name:'Wedding ceremony',description:'The Hindu wedding ceremony beneath the mandap.',type:'Ceremony'},
{id:'gujarati-lunch',start:'13:00',end:'14:30',name:'Wedding lunch',description:'A meal with family and guests after the ceremony.',type:'Food'},
{id:'gujarati-reception',start:'19:00',end:'00:30',name:'Reception',description:'Dinner, speeches and dancing.',type:'Celebration'}]}],
'South Indian':[
{id:'south-day-1',label:'Day 1',date:'Thursday',events:[
{id:'south-welcome',start:'18:00',end:'21:00',name:'Family welcome',description:'A relaxed gathering for the families and guests before the wedding day.',type:'Celebration'}]},
{id:'south-day-2',label:'Day 2',date:'Friday',events:[
{id:'south-ceremony',start:'09:00',end:'11:30',name:'Wedding ceremony',description:'The main wedding ceremony. Rename and adapt this to your family’s regional traditions.',type:'Ceremony'},
{id:'south-lunch',start:'12:00',end:'14:00',name:'Wedding lunch',description:'A celebratory meal with family and guests.',type:'Food'},
{id:'south-reception',start:'18:30',end:'23:30',name:'Reception',description:'An evening reception with dinner and celebrations.',type:'Celebration'}]}],
'Muslim':[
{id:'muslim-day-1',label:'Day 1',date:'Thursday',events:[
{id:'muslim-mehndi',start:'18:00',end:'22:00',name:'Mehndi',description:'A pre-wedding celebration with family, music and henna.',type:'Celebration'}]},
{id:'muslim-day-2',label:'Day 2',date:'Friday',events:[
{id:'muslim-nikah',start:'12:00',end:'13:00',name:'Nikah',description:'The Islamic marriage ceremony.',type:'Ceremony'},
{id:'muslim-meal',start:'13:30',end:'15:00',name:'Wedding meal',description:'A meal with family and guests following the ceremony.',type:'Food'}]},
{id:'muslim-day-3',label:'Day 3',date:'Saturday',events:[
{id:'muslim-walima',start:'18:30',end:'23:00',name:'Walima',description:'A wedding celebration and meal for family and guests.',type:'Celebration'}]}],
};
const neutralTemplate:WeddingDay[]=[{id:'custom-day-1',label:'Day 1',date:'Wedding day',events:[
{id:'custom-ceremony',start:'12:00',end:'13:00',name:'Wedding ceremony',description:'Add the details of your ceremony.',type:'Ceremony'},
{id:'custom-celebration',start:'18:00',end:'23:00',name:'Celebration',description:'Add your evening plans, meal or reception.',type:'Celebration'}]}];
const cloneDays=(days:WeddingDay[])=>days.map(day=>({...day,events:day.events.map(event=>({...event}))}));
const templateFor=(traditions:string[])=>{
 const selected=traditions.filter(t=>templates[t]);
 if(selected.length!==1)return cloneDays(neutralTemplate);
 return cloneDays(templates[selected[0]]);
};

const newEvent=():WeddingEvent=>({id:`event-${Date.now()}`,start:'12:00',end:'13:00',name:'New event',description:'Add a helpful description for your guests.',type:'Custom'});
const iconFor=(type:EventType)=>type==='Food'?'♨':type==='Ceremony'?'♡':type==='Tradition'?'✦':type==='Travel'?'▣':type==='Custom'?'＋':'♫';

export default function ScheduleBuilder(){
 const [days,setDays]=useState<WeddingDay[]>(neutralTemplate);
 const [hydrated,setHydrated]=useState(false);
 const [traditions,setTraditions]=useState<string[]>([]);
 const [editing,setEditing]=useState<{dayId:string,event:WeddingEvent}|null>(null);
 const [menu,setMenu]=useState<string|null>(null);
 useEffect(()=>{const draft=readWeddingDraft();const selected=draft.traditions||[];setTraditions(selected);setDays(draft.schedule?.length?draft.schedule:templateFor(selected));setHydrated(true)},[]);
 useEffect(()=>{if(!hydrated)return;writeWeddingDraft({schedule:days});const next={...readWeddingDraft(),schedule:days};const slug=weddingSlug(next);fetch(`/api/weddings/${encodeURIComponent(slug)}/sync`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(next)}).catch(error=>console.error('D1 schedule save failed',error))},[days,hydrated]);
 const events=useMemo(()=>days.flatMap(d=>d.events),[days]); const first=events[0],last=events.at(-1);
 const add=(dayId=days[0]?.id)=>{if(dayId)setEditing({dayId,event:newEvent()})};
 const save=()=>{if(!editing)return;setDays(ds=>ds.map(d=>d.id!==editing.dayId?d:{...d,events:d.events.some(e=>e.id===editing.event.id)?d.events.map(e=>e.id===editing.event.id?editing.event:e):[...d.events,editing.event]}));setEditing(null)};
 const remove=(dayId:string,id:string)=>{setDays(ds=>ds.map(d=>d.id===dayId?{...d,events:d.events.filter(e=>e.id!==id)}:d));setMenu(null)};
 const move=(dayId:string,id:string,dir:-1|1)=>{setDays(ds=>ds.map(d=>{if(d.id!==dayId)return d;const i=d.events.findIndex(e=>e.id===id),t=i+dir;if(i<0||t<0||t>=d.events.length)return d;const e=[...d.events];[e[i],e[t]]=[e[t],e[i]];return{...d,events:e}}));setMenu(null)};
 return <>
 <div className={styles.heading}><div><p>STEP 3 OF 4</p><h1>Build your schedule</h1><span>We’ve suggested a starting point. Now make it yours.</span></div><button onClick={()=>add()}>＋ Add event</button></div>
 <div className={styles.tip}><strong>A starting point, not a prescription.</strong><span>These events are suggestions based on the traditions you selected. Rename, reorder, remove or add anything your families need.</span></div>
 <div className={styles.workspace}><section className={styles.schedule}>{days.map(day=><article className={styles.day} key={day.id}><div className={styles.dayTitle}><div><small>{day.label}</small><h2>{day.date}</h2></div><button onClick={()=>add(day.id)}>＋ Add to day</button></div><div className={styles.events}>{day.events.map(event=><div className={styles.event} key={event.id}><span className={styles.grab}>⠿</span><div className={styles.time}><strong>{event.start}</strong><small>{event.end}</small></div><div className={styles.marker}>{iconFor(event.type)}</div><div className={styles.eventCopy}><div><h3>{event.name}</h3><span>{event.type}</span></div><p>{event.description}</p></div><button className={styles.edit} onClick={()=>setEditing({dayId:day.id,event:{...event}})}>Edit</button><div className={styles.menuWrap}><button className={styles.more} onClick={()=>setMenu(menu===event.id?null:event.id)}>•••</button>{menu===event.id&&<div className={styles.menu}><button onClick={()=>move(day.id,event.id,-1)}>Move up</button><button onClick={()=>move(day.id,event.id,1)}>Move down</button><button onClick={()=>remove(day.id,event.id)}>Remove</button></div>}</div></div>)}</div></article>)}</section>
 <aside className={styles.summary}><small>YOUR WEDDING WEEKEND</small><h2>{days.length} days.<br/>{events.length} moments.</h2><dl><div><dt>Traditions</dt><dd>{traditions.length?traditions.join(' · '):'Custom wedding'}</dd></div><div><dt>First event</dt><dd>{first?`${first.name} · ${first.start}`:'Not set'}</dd></div><div><dt>Final event</dt><dd>{last?.name??'Not set'}</dd></div></dl><div className={styles.custom}><strong>Something missing?</strong><p>Every wedding is different. Add ceremonies, family events, meals, travel or anything else.</p><button onClick={()=>add()}>＋ Add custom event</button></div></aside></div>
 <footer className={styles.builderFooter}><Link href="/create/traditions">← Traditions</Link><Link className={styles.continue} href="/create/invite">Looks good · invite guests →</Link></footer>
 {editing&&<div className={styles.modalBackdrop} onMouseDown={()=>setEditing(null)}><section className={styles.modal} onMouseDown={e=>e.stopPropagation()}><div className={styles.modalHead}><div><small>EDIT MOMENT</small><h2>{editing.event.name}</h2></div><button onClick={()=>setEditing(null)}>×</button></div><div className={styles.modalForm}><label>Event name<input value={editing.event.name} onChange={e=>setEditing({...editing,event:{...editing.event,name:e.target.value}})}/></label><div className={styles.modalRow}><label>Starts<input type="time" value={editing.event.start} onChange={e=>setEditing({...editing,event:{...editing.event,start:e.target.value}})}/></label><label>Ends<input type="time" value={editing.event.end} onChange={e=>setEditing({...editing,event:{...editing.event,end:e.target.value}})}/></label></div><label>Type<select value={editing.event.type} onChange={e=>setEditing({...editing,event:{...editing.event,type:e.target.value as EventType}})}><option>Celebration</option><option>Food</option><option>Tradition</option><option>Ceremony</option><option>Travel</option><option>Custom</option></select></label><label>Description<textarea rows={4} value={editing.event.description} onChange={e=>setEditing({...editing,event:{...editing.event,description:e.target.value}})}/></label></div><div className={styles.modalActions}><button onClick={()=>setEditing(null)}>Cancel</button><button className={styles.save} onClick={save}>Save event</button></div></section></div>}
 </>;
}
