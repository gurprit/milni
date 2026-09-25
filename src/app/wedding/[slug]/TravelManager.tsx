'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { LocationInfo, WeddingDraft, TravelItem, VenueInfo } from '../../../lib/weddingDraft';
import { GoogleLocationInput, GoogleMap, googleDirectionsUrl } from './GoogleLocationInput';
import styles from './travel.module.scss';

const starterTravel:TravelItem[]=[
 {id:'travel-coach-gurdwara',name:'Coach to the Gurdwara',time:'09:00',place:'Hotel entrance',destination:'Gurdwara',note:'Seats reserved for wedding guests'},
 {id:'travel-coach-reception',name:'Coach to reception',time:'15:30',place:'Gurdwara car park',destination:'Reception',note:'Departs after photographs'},
 {id:'travel-return',name:'Return coaches',time:'00:00',place:'Reception entrance',destination:'Hotel',note:'Late-night return service'}
];
const emptyVenue:VenueInfo={name:'Wedding venue',address:'',parking:'',taxiInfo:''};
type SaveState='idle'|'saving'|'saved';
type CoachLive={status:string;lat:number|null;lng:number|null;accuracy:number|null;startedAt:string|null;updatedAt:string|null;arrivedAt:string|null;stale:boolean};
type CoachJourney=TravelItem&{trackerGuestIds?:string[];trackerNames?:string[];organiserCanTrack?:boolean;canTrack?:boolean;isCurrentTracker?:boolean;live?:CoachLive};
type TrackerGuest={id:string;name:string;group:string};

const idleLive:CoachLive={status:'idle',lat:null,lng:null,accuracy:null,startedAt:null,updatedAt:null,arrivedAt:null,stale:false};

type TravelEventRef={id:string;label:string;date:string;start:string};

function travelTimeMinutes(value:string){
 const match=/^(\d{2}):(\d{2})$/.exec(value||'');
 return match?Number(match[1])*60+Number(match[2]):Number.POSITIVE_INFINITY;
}

function sortTravelChronologically(items:CoachJourney[],events:TravelEventRef[]){
 const eventById=new Map(events.map(event=>[event.id,event]));
 return items.map((item,index)=>({item,index,event:item.linkedEventId?eventById.get(item.linkedEventId):undefined}))
  .sort((a,b)=>{
   const aDate=a.event?.date||'9999-12-31';
   const bDate=b.event?.date||'9999-12-31';
   const dateOrder=aDate.localeCompare(bDate);
   if(dateOrder)return dateOrder;
   const aEventTime=a.event?travelTimeMinutes(a.event.start):travelTimeMinutes(a.item.time);
   const bEventTime=b.event?travelTimeMinutes(b.event.start):travelTimeMinutes(b.item.time);
   if(aEventTime!==bEventTime)return aEventTime-bEventTime;
   const departureOrder=travelTimeMinutes(a.item.time)-travelTimeMinutes(b.item.time);
   return departureOrder||a.index-b.index;
  })
  .map(entry=>entry.item);
}

export default function TravelManager({draft,save,organiser}:{draft:WeddingDraft;save:(p:Partial<WeddingDraft>)=>void;organiser:boolean}){
 const params=useParams();
 const slug=String(params.slug||'our-wedding');
 const localTravel=draft.travel?.length?draft.travel:starterTravel;
 const venue=draft.venue??emptyVenue;
 const events:TravelEventRef[]=(draft.schedule??[]).flatMap(day=>day.events.map(event=>({id:event.id,label:`${day.label} · ${event.start} · ${event.name}`,date:day.date,start:event.start}))).sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')||travelTimeMinutes(a.start)-travelTimeMinutes(b.start));
 const [saveState,setSaveState]=useState<SaveState>('idle');
 const [openPickup,setOpenPickup]=useState<string|null>(null);
 const [remoteTravel,setRemoteTravel]=useState<CoachJourney[]|null>(null);
 const [trackerGuests,setTrackerGuests]=useState<TrackerGuest[]>([]);
 const [coachError,setCoachError]=useState('');
 const [trackingError,setTrackingError]=useState('');
 const [trackingJourneyId,setTrackingJourneyId]=useState<string|null>(null);
 const [busyJourney,setBusyJourney]=useState<string|null>(null);
 const savingTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const idleTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const geoWatchRef=useRef<number|null>(null);
 const lastSentRef=useRef(0);
 const wakeLockRef=useRef<any>(null);
 const initialisedRef=useRef(false);
 const travelRef=useRef<TravelItem[]>(localTravel);
 travelRef.current=localTravel;

 const travel:CoachJourney[]=(remoteTravel?.length?remoteTravel:localTravel.map(item=>({...item,trackerGuestIds:[],trackerNames:[],live:idleLive})));
 const orderedTravel=sortTravelChronologically(travel,events);

 const releaseTrackingResources=useCallback(()=>{
  if(geoWatchRef.current!=null&&typeof navigator!=='undefined'&&navigator.geolocation){
   navigator.geolocation.clearWatch(geoWatchRef.current);
   geoWatchRef.current=null;
  }
  if(wakeLockRef.current){
   void wakeLockRef.current.release?.().catch?.(()=>{});
   wakeLockRef.current=null;
  }
  setTrackingJourneyId(null);
 },[]);

 useEffect(()=>()=>{if(savingTimer.current)clearTimeout(savingTimer.current);if(idleTimer.current)clearTimeout(idleTimer.current);releaseTrackingResources()},[releaseTrackingResources]);

 const showSaved=()=>{if(savingTimer.current)clearTimeout(savingTimer.current);if(idleTimer.current)clearTimeout(idleTimer.current);setSaveState('saving');savingTimer.current=setTimeout(()=>{setSaveState('saved');idleTimer.current=setTimeout(()=>setSaveState('idle'),2400)},320)};
 const saveWithFeedback=(patch:Partial<WeddingDraft>)=>{save(patch);showSaved()};

 const saveCoachSetup=useCallback(async(next:CoachJourney[])=>{
  try{
   setCoachError('');
   const response=await fetch(`/api/coaches/${encodeURIComponent(slug)}`,{
    method:'PUT',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({journeys:next.map(item=>({
     id:item.id,name:item.name,time:item.time,place:item.place,destination:item.destination??'',note:item.note,
     linkedEventId:item.linkedEventId??'',pickupLocation:item.pickupLocation,destinationLocation:item.destinationLocation,
     trackerGuestIds:item.trackerGuestIds??[],organiserCanTrack:item.organiserCanTrack??false
    }))})
   });
   const result=await response.json();
   if(!response.ok)throw new Error(result.error||'Could not save coach setup');
  }catch(error){setCoachError(error instanceof Error?error.message:'Could not save coach setup')}
 },[slug]);

 const loadCoachData=useCallback(async()=>{
  try{
   const response=await fetch(`/api/coaches/${encodeURIComponent(slug)}`,{cache:'no-store'});
   const result=await response.json();
   if(!response.ok){
    if(response.status!==401)setCoachError(result.error||'Could not load coach tracking');
    return;
   }
   setTrackerGuests(result.guests??[]);
   const journeys:CoachJourney[]=result.journeys??[];
   if(journeys.length){
    setRemoteTravel(journeys);
   }else if(organiser&&!initialisedRef.current){
    initialisedRef.current=true;
    const initial=travelRef.current.map(item=>({...item,trackerGuestIds:[],trackerNames:[],organiserCanTrack:false,canTrack:false,isCurrentTracker:false,live:idleLive}));
    setRemoteTravel(initial);
    await saveCoachSetup(initial);
   }
  }catch(error){setCoachError(error instanceof Error?error.message:'Could not load coach tracking')}
 },[organiser,saveCoachSetup,slug]);

 useEffect(()=>{void loadCoachData();const timer=window.setInterval(()=>void loadCoachData(),5000);return()=>window.clearInterval(timer)},[loadCoachData]);

 const persistTravel=(nextItems:TravelItem[])=>{
  saveWithFeedback({travel:nextItems});
  setRemoteTravel(previous=>{
   const source=previous??travel;
   const next=nextItems.map(item=>{
    const existing=source.find(candidate=>candidate.id===item.id);
    return {...item,trackerGuestIds:existing?.trackerGuestIds??[],trackerNames:existing?.trackerNames??[],organiserCanTrack:existing?.organiserCanTrack??false,canTrack:existing?.canTrack??false,isCurrentTracker:existing?.isCurrentTracker??false,live:existing?.live??idleLive};
   });
   void saveCoachSetup(next);
   return next;
  });
 };
 const updateTravel=useCallback((id:string,patch:Partial<TravelItem>)=>persistTravel(travel.map(item=>item.id===id?{...item,...patch}:item)),[travel]);
 const addTravel=()=>persistTravel([...travel,{id:`travel-${Date.now()}`,name:'New journey',time:'10:00',place:'',destination:'',note:'',linkedEventId:''}]);
 const removeTravel=(id:string)=>{if(window.confirm('Remove this journey?'))persistTravel(travel.filter(item=>item.id!==id))};
 const updateVenue=useCallback((patch:Partial<VenueInfo>)=>saveWithFeedback({venue:{...venue,...patch}}),[venue]);
 const pickupSelected=(id:string,location:LocationInfo)=>updateTravel(id,{place:location.formattedAddress,pickupLocation:location});
 const destinationSelected=(id:string,location:LocationInfo)=>updateTravel(id,{destination:location.formattedAddress,destinationLocation:location});
 const venueSelected=(location:LocationInfo)=>updateVenue({address:location.formattedAddress,location});

 const toggleOrganiserTracker=(journeyId:string)=>{setRemoteTravel(previous=>{const source=previous??travel;const next=source.map(item=>item.id===journeyId?{...item,organiserCanTrack:!item.organiserCanTrack}:item);void saveCoachSetup(next);return next})};
 const toggleTracker=(journeyId:string,guestId:string)=>{
  setRemoteTravel(previous=>{
   const source=previous??travel;
   const next=source.map(item=>{
    if(item.id!==journeyId)return item;
    const current=item.trackerGuestIds??[];
    if(current.includes(guestId))return {...item,trackerGuestIds:current.filter(id=>id!==guestId)};
    if(current.length>=3){setCoachError('Choose up to three nominated trackers for each coach.');return item}
    return {...item,trackerGuestIds:[...current,guestId]};
   });
   void saveCoachSetup(next);
   return next;
  });
 };

 const patchCoach=useCallback(async(journeyId:string,action:string,position?:GeolocationPosition)=>{
  const response=await fetch(`/api/coaches/${encodeURIComponent(slug)}`,{
   method:'PATCH',headers:{'content-type':'application/json'},
   body:JSON.stringify({journeyId,action,lat:position?.coords.latitude,lng:position?.coords.longitude,accuracy:position?.coords.accuracy})
  });
  const result=await response.json();
  if(!response.ok)throw Object.assign(new Error(result.error||'Could not update coach tracking'),{status:response.status});
  return result;
 },[slug]);

 const requestWakeLock=async()=>{
  try{if(typeof navigator!=='undefined'&&(navigator as any).wakeLock?.request)wakeLockRef.current=await (navigator as any).wakeLock.request('screen')}catch{}
 };

 const startTracking=(journeyId:string)=>{
  setTrackingError('');
  if(typeof navigator==='undefined'||!navigator.geolocation){setTrackingError('Location sharing is not available on this device.');return}
  setBusyJourney(journeyId);
  navigator.geolocation.getCurrentPosition(async position=>{
   try{
    releaseTrackingResources();
    await patchCoach(journeyId,'start',position);
    setTrackingJourneyId(journeyId);
    lastSentRef.current=Date.now();
    await requestWakeLock();
    geoWatchRef.current=navigator.geolocation.watchPosition(next=>{
     if(Date.now()-lastSentRef.current<10000)return;
     lastSentRef.current=Date.now();
     void patchCoach(journeyId,'position',next).then(()=>loadCoachData()).catch((error:any)=>{
      if(error?.status===409)releaseTrackingResources();
      setTrackingError(error instanceof Error?error.message:'Coach location update failed');
     });
    },error=>setTrackingError(error.message||'Could not read your location.'),{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
    await loadCoachData();
   }catch(error){setTrackingError(error instanceof Error?error.message:'Could not start coach tracking')}
   finally{setBusyJourney(null)}
  },error=>{setBusyJourney(null);setTrackingError(error.message||'Please allow location access to track this coach.')},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
 };

 const finishJourney=async(journeyId:string,action:'arrive'|'stop')=>{
  setBusyJourney(journeyId);setTrackingError('');
  try{await patchCoach(journeyId,action);releaseTrackingResources();await loadCoachData()}
  catch(error){setTrackingError(error instanceof Error?error.message:'Could not update coach tracking')}
  finally{setBusyJourney(null)}
 };

 const liveLocation=(item:CoachJourney):LocationInfo|undefined=>item.live?.lat!=null&&item.live?.lng!=null?{name:`${item.name} live location`,formattedAddress:'Live coach position',lat:item.live.lat,lng:item.live.lng}:undefined;
 const updatedLabel=(value:string|null|undefined)=>{if(!value)return'';const seconds=Math.max(0,Math.round((Date.now()-Date.parse(value))/1000));if(seconds<10)return'just now';if(seconds<60)return`${seconds}s ago`;return`${Math.round(seconds/60)}m ago`};

 if(!organiser)return <div className={styles.travelGuestGrid}><section className={styles.card}><div className={styles.eyebrow}>GETTING AROUND</div><h2>Wedding transport</h2>{coachError&&<div className={styles.coachError}>{coachError}</div>}{trackingError&&<div className={styles.coachError}>{trackingError}</div>}{orderedTravel.map(item=><div className={styles.infoRow} key={item.id}><strong>{item.time}</strong><span><h3>{item.name}</h3><p>{item.place}{item.destination?` → ${item.destination}`:''}</p>{item.note&&<p>{item.note}</p>}{item.live?.status==='tracking'&&<div className={styles.liveCoach}><div className={styles.liveCoachHead}><span className={item.live.stale?styles.signalStale:styles.signalLive}/><b>{item.live.stale?'Live signal paused':'Coach is on the move'}</b><small>{item.live.updatedAt?`Updated ${updatedLabel(item.live.updatedAt)}`:''}</small></div>{liveLocation(item)&&<GoogleMap location={liveLocation(item)} label={item.name} className={styles.liveMap}/>}<p>{item.live.stale?'The tracker may have locked their phone or lost signal. The last known position is shown.':'This position updates while the nominated tracker keeps Milni active.'}</p></div>}{item.live?.status==='arrived'&&<div className={styles.arrivedBadge}>✓ Arrived at destination</div>}{item.canTrack&&item.live?.status!=='arrived'&&<div className={styles.trackerControls}><div><b>You’re a coach tracker</b><small>Your location is shared only for this journey.</small></div>{item.live?.status==='tracking'&&trackingJourneyId===item.id?<><button disabled={busyJourney===item.id} onClick={()=>void finishJourney(item.id,'arrive')}>Reached destination ✓</button><button className={styles.stopTracking} disabled={busyJourney===item.id} onClick={()=>void finishJourney(item.id,'stop')}>Stop sharing</button></>:<button disabled={busyJourney===item.id} onClick={()=>startTracking(item.id)}>{busyJourney===item.id?'Starting…':item.live?.status==='tracking'?(item.isCurrentTracker?'Resume tracking':'Take over tracking'):'Start coach tracking'}</button>}</div>}{item.pickupLocation?.lat!=null&&<><button className={styles.revealMap} onClick={()=>setOpenPickup(openPickup===item.id?null:item.id)}>{openPickup===item.id?'Hide pickup map':'View pickup point'} {openPickup===item.id?'⌃':'⌄'}</button>{openPickup===item.id&&<div className={styles.pickupReveal}><GoogleMap location={item.pickupLocation} label={`${item.name} pickup`} className={styles.smallMap}/><a className={styles.directionsLink} href={googleDirectionsUrl(item.pickupLocation)} target="_blank" rel="noreferrer">Directions to pickup ↗</a></div>}</>}</span></div>)}</section><section className={`${styles.card} ${styles.tint}`}><div className={styles.eyebrow}>VENUE</div><h2>{venue.name||'Venue & directions'}</h2><GoogleMap location={venue.location} label={venue.name||'Wedding venue'} className={styles.map}/>{venue.address&&<p>{venue.address}</p>}{venue.location&&<a className={styles.mapLink} href={googleDirectionsUrl(venue.location)} target="_blank" rel="noreferrer">Directions to venue ↗</a>}{venue.parking&&<><h3>Parking</h3><p>{venue.parking}</p></>}{venue.taxiInfo&&<><h3>Taxi information</h3><p>{venue.taxiInfo}</p></>}</section></div>;

 return <div className={styles.travelAdmin}><div className={styles.editorIntro}><div><strong>Manage travel</strong><span>Keep coaches, pickup points, live trackers, venue directions and late-night journeys in one place.</span></div><div className={styles.editorIntroActions}><div className={`${styles.saveStatus} ${saveState==='saved'?styles.saveStatusVisible:''} ${saveState==='saving'?styles.saveStatusSaving:''}`} role="status" aria-live="polite">{saveState==='saving'?<><span className={styles.saveSpinner}/>Saving…</>:<><span className={styles.saveTick}>✓</span>Changes saved</>}</div><button onClick={addTravel}>＋ Add journey</button></div></div>{coachError&&<div className={styles.coachError}>{coachError}</div>}<div className={styles.travelAdminGrid}><section className={styles.travelJourneys}><div className={styles.travelSectionHead}><div><div className={styles.eyebrow}>TRANSPORT</div><h2>Guest journeys</h2></div><span>{travel.length} journey{travel.length===1?'':'s'}</span></div>{orderedTravel.map(item=><article className={styles.travelEditorCard} key={item.id}><div className={styles.travelEditorTop}><label>Journey name<input value={item.name} onChange={e=>updateTravel(item.id,{name:e.target.value})}/></label><label>Departure<input type="time" value={item.time} onChange={e=>updateTravel(item.id,{time:e.target.value})}/></label></div><div className={styles.travelEditorRoute}><label>Pickup point<GoogleLocationInput value={item.place} placeholder="Search for a pickup address…" onChange={value=>updateTravel(item.id,{place:value,pickupLocation:undefined})} onSelect={location=>pickupSelected(item.id,location)}/></label><span>→</span><label>Destination<GoogleLocationInput value={item.destination??''} placeholder="Search for a destination…" onChange={value=>updateTravel(item.id,{destination:value,destinationLocation:undefined})} onSelect={location=>destinationSelected(item.id,location)}/></label></div>{item.pickupLocation?.lat!=null&&<div className={styles.editorMapPreview}><GoogleMap location={item.pickupLocation} label={`${item.name} pickup`} className={styles.smallMap}/><span>Pickup map will be available to guests</span></div>}<label>Guest notes<textarea rows={2} value={item.note} placeholder="Where to meet, who this coach is for, accessibility notes…" onChange={e=>updateTravel(item.id,{note:e.target.value})}/></label><div className={styles.trackerEditor}><div><span>LIVE COACH TRACKER</span><b>Nominate up to 3 guests</b><p>When they board, a nominated tracker can start sharing this coach’s location. Another nominee can take over if needed.</p><label className={styles.organiserTracker}><input type="checkbox" checked={!!item.organiserCanTrack} onChange={()=>toggleOrganiserTracker(item.id)}/><span><b>Wedding organiser</b><small>Allow an organiser to start tracking too</small></span></label></div><div className={styles.trackerChoices}>{trackerGuests.length?trackerGuests.map(person=><label key={person.id}><input type="checkbox" checked={(item.trackerGuestIds??[]).includes(person.id)} onChange={()=>toggleTracker(item.id,person.id)}/><span><b>{person.name}</b><small>{person.group||'Wedding guest'}</small></span></label>):<small>Guest list is loading…</small>}</div></div><div className={styles.travelEditorFooter}><label>Link to schedule event<select value={item.linkedEventId??''} onChange={e=>updateTravel(item.id,{linkedEventId:e.target.value})}><option value="">No linked event</option>{events.map(event=><option value={event.id} key={event.id}>{event.label}</option>)}</select></label><button className={styles.removeButton} onClick={()=>removeTravel(item.id)}>Remove journey</button></div></article>)}<button className={styles.addEventButton} onClick={addTravel}>＋ Add another journey</button></section><aside className={styles.venueEditor}><div className={styles.eyebrow}>VENUE & DIRECTIONS</div><h2>Guest arrival information</h2><p>Start typing the venue address and choose a Google suggestion. MILNI will create the map automatically.</p><label>Venue name<input value={venue.name} onChange={e=>updateVenue({name:e.target.value})}/></label><label>Venue address<GoogleLocationInput value={venue.address} placeholder="Search for the venue…" onChange={value=>updateVenue({address:value,location:undefined})} onSelect={venueSelected}/></label><GoogleMap location={venue.location} label={venue.name||'Wedding venue'} className={styles.adminVenueMap}/><label>Parking instructions<textarea rows={3} value={venue.parking} placeholder="Where guests should park, permits, drop-off…" onChange={e=>updateVenue({parking:e.target.value})}/></label><label>Taxi / local transport<textarea rows={3} value={venue.taxiInfo} placeholder="Recommended taxi firms, station information…" onChange={e=>updateVenue({taxiInfo:e.target.value})}/></label></aside></div></div>;
}
