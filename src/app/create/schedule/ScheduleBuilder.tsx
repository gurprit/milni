'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.scss';

type EventType = 'Celebration' | 'Food' | 'Tradition' | 'Ceremony' | 'Travel' | 'Custom';
type WeddingEvent = { id:string; start:string; end:string; name:string; description:string; type:EventType };
type WeddingDay = { id:string; label:string; date:string; events:WeddingEvent[] };

const initialDays:WeddingDay[]=[
{id:'day-1',label:'Day 1',date:'Thursday',events:[
{id:'haldi',start:'11:00',end:'12:30',name:'Haldi',description:'A joyful start with colour, blessings and plenty of smiles.',type:'Celebration'},
{id:'lunch',start:'13:00',end:'14:30',name:'Lunch',description:'Time to eat, catch up and settle into the weekend.',type:'Food'},
{id:'sangeet',start:'19:00',end:'23:00',name:'Sangeet',description:'Music, dancing and performances with family and friends.',type:'Celebration'}]},
{id:'day-2',label:'Day 2',date:'Friday',events:[
{id:'baraat',start:'11:30',end:'12:00',name:'Baraat',description:"The groom's procession and arrival.",type:'Tradition'},
{id:'milni',start:'12:15',end:'12:45',name:'Milni',description:'A meeting and welcome between the families.',type:'Tradition'},
{id:'anand-karaj',start:'13:00',end:'14:30',name:'Anand Karaj',description:'The Sikh wedding ceremony.',type:'Ceremony'},
{id:'reception',start:'19:30',end:'00:30',name:'Reception',description:'Dinner, dancing and celebrations.',type:'Celebration'}]},
{id:'day-3',label:'Day 3',date:'Saturday',events:[
{id:'brunch',start:'11:00',end:'13:00',name:'Farewell brunch',description:'One last meal together before everyone heads home.',type:'Food'}]}];

const newEvent=():WeddingEvent=>({id:`event-${Date.now()}`,start:'12:00',end:'13:00',name:'New event',description:'Add a helpful description for your guests.',type:'Custom'});
const iconFor=(type:EventType)=>type==='Food'?'♨':type==='Ceremony'?'♡':type==='Tradition'?'✦':type==='Travel'?'▣':type==='Custom'?'＋':'♫';

export default function ScheduleBuilder(){
 const [days,setDays]=useState(initialDays);
 const [editing,setEditing]=useState<{dayId:string,event:WeddingEvent}|null>(null);
 const [menu,setMenu]=useState<string|null>(null);
 const events=useMemo(()=>days.flatMap(d=>d.events),[days]); const first=events[0],last=events.at(-1);
 const add=(dayId=days[0].id)=>setEditing({dayId,event:newEvent()});
 const save=()=>{if(!editing)return;setDays(ds=>ds.map(d=>d.id!==editing.dayId?d:{...d,events:d.events.some(e=>e.id===editing.event.id)?d.events.map(e=>e.id===editing.event.id?editing.event:e):[...d.events,editing.event]}));setEditing(null)};
 const remove=(dayId:string,id:string)=>{setDays(ds=>ds.map(d=>d.id===dayId?{...d,events:d.events.filter(e=>e.id!==id)}:d));setMenu(null)};
 const move=(dayId:string,id:string,dir:-1|1)=>{setDays(ds=>ds.map(d=>{if(d.id!==dayId)return d;const i=d.events.findIndex(e=>e.id===id),t=i+dir;if(i<0||t<0||t>=d.events.length)return d;const e=[...d.events];[e[i],e[t]]=[e[t],e[i]];return{...d,events:e}}));setMenu(null)};
 return <>
 <div className={styles.heading}><div><p>STEP 3 OF 4</p><h1>Build your schedule</h1><span>We’ve suggested a starting point. Now make it yours.</span></div><button onClick={()=>add()}>＋ Add event</button></div>
 <div className={styles.tip}><strong>A starting point, not a prescription.</strong><span>These events are suggestions based on the traditions you selected. Rename, reorder, remove or add anything your families need.</span></div>
 <div className={styles.workspace}><section className={styles.schedule}>{days.map(day=><article className={styles.day} key={day.id}><div className={styles.dayTitle}><div><small>{day.label}</small><h2>{day.date}</h2></div><button onClick={()=>add(day.id)}>＋ Add to day</button></div><div className={styles.events}>{day.events.map(event=><div className={styles.event} key={event.id}><span className={styles.grab}>⠿</span><div className={styles.time}><strong>{event.start}</strong><small>{event.end}</small></div><div className={styles.marker}>{iconFor(event.type)}</div><div className={styles.eventCopy}><div><h3>{event.name}</h3><span>{event.type}</span></div><p>{event.description}</p></div><button className={styles.edit} onClick={()=>setEditing({dayId:day.id,event:{...event}})}>Edit</button><div className={styles.menuWrap}><button className={styles.more} onClick={()=>setMenu(menu===event.id?null:event.id)}>•••</button>{menu===event.id&&<div className={styles.menu}><button onClick={()=>move(day.id,event.id,-1)}>Move up</button><button onClick={()=>move(day.id,event.id,1)}>Move down</button><button onClick={()=>remove(day.id,event.id)}>Remove</button></div>}</div></div>)}</div></article>)}</section>
 <aside className={styles.summary}><small>YOUR WEDDING WEEKEND</small><h2>{days.length} days.<br/>{events.length} moments.</h2><dl><div><dt>Traditions</dt><dd>Punjabi Sikh</dd></div><div><dt>First event</dt><dd>{first?`${first.name} · ${first.start}`:'Not set'}</dd></div><div><dt>Final event</dt><dd>{last?.name??'Not set'}</dd></div></dl><div className={styles.custom}><strong>Something missing?</strong><p>Every wedding is different. Add ceremonies, family events, meals, travel or anything else.</p><button onClick={()=>add()}>＋ Add custom event</button></div></aside></div>
 <footer className={styles.builderFooter}><Link href="/create/traditions">← Traditions</Link><Link className={styles.continue} href="/create/invite">Looks good · invite guests →</Link></footer>
 {editing&&<div className={styles.modalBackdrop} onMouseDown={()=>setEditing(null)}><section className={styles.modal} onMouseDown={e=>e.stopPropagation()}><div className={styles.modalHead}><div><small>EDIT MOMENT</small><h2>{editing.event.name}</h2></div><button onClick={()=>setEditing(null)}>×</button></div><div className={styles.modalForm}><label>Event name<input value={editing.event.name} onChange={e=>setEditing({...editing,event:{...editing.event,name:e.target.value}})}/></label><div className={styles.modalRow}><label>Starts<input type="time" value={editing.event.start} onChange={e=>setEditing({...editing,event:{...editing.event,start:e.target.value}})}/></label><label>Ends<input type="time" value={editing.event.end} onChange={e=>setEditing({...editing,event:{...editing.event,end:e.target.value}})}/></label></div><label>Type<select value={editing.event.type} onChange={e=>setEditing({...editing,event:{...editing.event,type:e.target.value as EventType}})}><option>Celebration</option><option>Food</option><option>Tradition</option><option>Ceremony</option><option>Travel</option><option>Custom</option></select></label><label>Description<textarea rows={4} value={editing.event.description} onChange={e=>setEditing({...editing,event:{...editing.event,description:e.target.value}})}/></label></div><div className={styles.modalActions}><button onClick={()=>setEditing(null)}>Cancel</button><button className={styles.save} onClick={save}>Save event</button></div></section></div>}
 </>;
}
