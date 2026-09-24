import {NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../lib/d1';
import {currentGuestSession} from '../../../../lib/guestSession';
import {currentOrganiserSession} from '../../../../lib/organiserSession';
import {organiserCanAccessWedding} from '../../../../lib/organiserAccounts';
import {publishWeddingNotification} from '../../../../lib/notifications';

type WeddingRow={id:string};
type JourneyRow={id:string;name:string;time:string;place:string;destination:string|null;note:string;linked_event_id:string|null;pickup_json:string|null;destination_json:string|null;organiser_can_track?:number;sort_order:number};
type TrackerRow={journey_id:string;guest_id:string;name?:string};
type LiveRow={journey_id:string;status:string;lat:number|null;lng:number|null;accuracy:number|null;tracker_guest_id:string|null;started_at:string|null;updated_at:string|null;arrived_at:string|null};
type LocationInfo={name:string;formattedAddress:string;lat?:number;lng?:number;placeId?:string};
type JourneyInput={id:string;name:string;time:string;place:string;destination?:string;note:string;linkedEventId?:string;pickupLocation?:LocationInfo;destinationLocation?:LocationInfo;trackerGuestIds?:string[];organiserCanTrack?:boolean};

async function ensureTables(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS coach_journeys (
  wedding_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  time TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  destination TEXT,
  note TEXT NOT NULL DEFAULT '',
  linked_event_id TEXT,
  pickup_json TEXT,
  destination_json TEXT,
  organiser_can_track INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (wedding_id,id),
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 await d1Execute(`CREATE TABLE IF NOT EXISTS coach_trackers (
  wedding_id TEXT NOT NULL,
  journey_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (wedding_id,journey_id,guest_id),
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 await d1Execute(`CREATE TABLE IF NOT EXISTS coach_live_state (
  wedding_id TEXT NOT NULL,
  journey_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  lat REAL,
  lng REAL,
  accuracy REAL,
  tracker_guest_id TEXT,
  started_at TEXT,
  updated_at TEXT,
  arrived_at TEXT,
  PRIMARY KEY (wedding_id,journey_id),
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 try{await d1Execute('ALTER TABLE coach_journeys ADD COLUMN organiser_can_track INTEGER NOT NULL DEFAULT 0')}catch{}
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_coach_journeys_wedding ON coach_journeys(wedding_id,sort_order)');
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_coach_trackers_wedding ON coach_trackers(wedding_id,journey_id)');
}

async function weddingId(slug:string){
 return (await d1Query<WeddingRow>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0]?.id??null;
}
function parseLocation(value:string|null){
 if(!value)return undefined;
 try{return JSON.parse(value) as LocationInfo}catch{return undefined}
}
function validCoordinate(value:unknown,min:number,max:number){
 const number=Number(value);
 return Number.isFinite(number)&&number>=min&&number<=max?number:null;
}

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const [guest,organiserSession]=await Promise.all([currentGuestSession(),currentOrganiserSession()]);
  const organiser=await organiserCanAccessWedding(organiserSession,slug);
  const guestAllowed=!!guest&&guest.weddingId===id&&guest.weddingSlug===slug;
  if(!organiser&&!guestAllowed)return NextResponse.json({ok:false,error:'Join this wedding to view coach tracking.'},{status:401});

  await ensureTables();
  const [journeys,trackers,live,guests]=await Promise.all([
   d1Query<JourneyRow>('SELECT id,name,time,place,destination,note,linked_event_id,pickup_json,destination_json,organiser_can_track,sort_order FROM coach_journeys WHERE wedding_id=? ORDER BY sort_order',[id]),
   d1Query<TrackerRow>('SELECT ct.journey_id,ct.guest_id,g.name FROM coach_trackers ct LEFT JOIN guests g ON g.id=ct.guest_id AND g.wedding_id=ct.wedding_id WHERE ct.wedding_id=?',[id]),
   d1Query<LiveRow>('SELECT journey_id,status,lat,lng,accuracy,tracker_guest_id,started_at,updated_at,arrived_at FROM coach_live_state WHERE wedding_id=?',[id]),
   organiser?d1Query<{id:string;name:string;guest_group:string|null}>('SELECT id,name,guest_group FROM guests WHERE wedding_id=? ORDER BY name',[id]):Promise.resolve([])
  ]);

  const trackersByJourney=new Map<string,TrackerRow[]>();
  for(const tracker of trackers){
   const current=trackersByJourney.get(tracker.journey_id)??[];
   current.push(tracker);trackersByJourney.set(tracker.journey_id,current);
  }
  const liveByJourney=new Map(live.map(item=>[item.journey_id,item]));
  const now=Date.now();

  return NextResponse.json({
   ok:true,
   organiser,
   guests:organiser?guests.map(item=>({id:item.id,name:item.name,group:item.guest_group??''})):[],
   journeys:journeys.map(journey=>{
    const assigned=trackersByJourney.get(journey.id)??[];
    const state=liveByJourney.get(journey.id);
    const updated=state?.updated_at?Date.parse(state.updated_at):0;
    return {
     id:journey.id,
     name:journey.name,
     time:journey.time,
     place:journey.place,
     destination:journey.destination??'',
     note:journey.note,
     linkedEventId:journey.linked_event_id??'',
     pickupLocation:parseLocation(journey.pickup_json),
     destinationLocation:parseLocation(journey.destination_json),
     trackerGuestIds:organiser?assigned.map(item=>item.guest_id):undefined,
     trackerNames:assigned.map(item=>item.name).filter(Boolean),
     organiserCanTrack:Boolean(journey.organiser_can_track),
     canTrack:(organiser&&Boolean(journey.organiser_can_track))||!!guest&&assigned.some(item=>item.guest_id===guest.guestId),
     isCurrentTracker:!!guest&&state?.tracker_guest_id===guest.guestId,
     live:state?{
      status:state.status,
      lat:state.lat,
      lng:state.lng,
      accuracy:state.accuracy,
      startedAt:state.started_at,
      updatedAt:state.updated_at,
      arrivedAt:state.arrived_at,
      stale:state.status==='tracking'&&!!updated&&now-updated>120000
     }:{status:'idle',lat:null,lng:null,accuracy:null,startedAt:null,updatedAt:null,arrivedAt:null,stale:false}
    };
   })
  });
 }catch(error){
  console.error('Coach tracking GET failed',error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load coach tracking'},{status:500});
 }
}

export async function PUT(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const organiserSession=await currentOrganiserSession();
  if(!await organiserCanAccessWedding(organiserSession,slug))return NextResponse.json({ok:false,error:'Organiser access required'},{status:403});
  const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const body=await request.json() as {journeys?:JourneyInput[]};
  const journeys=Array.isArray(body.journeys)?body.journeys.slice(0,50):[];
  await ensureTables();

  const incomingIds=journeys.map(item=>String(item.id||'')).filter(Boolean);
  const existing=await d1Query<{id:string}>('SELECT id FROM coach_journeys WHERE wedding_id=?',[id]);
  for(const row of existing){
   if(incomingIds.includes(row.id))continue;
   await d1Execute('DELETE FROM coach_live_state WHERE wedding_id=? AND journey_id=?',[id,row.id]);
   await d1Execute('DELETE FROM coach_trackers WHERE wedding_id=? AND journey_id=?',[id,row.id]);
   await d1Execute('DELETE FROM coach_journeys WHERE wedding_id=? AND id=?',[id,row.id]);
  }

  for(let index=0;index<journeys.length;index++){
   const journey=journeys[index];
   if(!journey.id||!journey.name)continue;
   await d1Execute(`INSERT INTO coach_journeys (wedding_id,id,name,time,place,destination,note,linked_event_id,pickup_json,destination_json,organiser_can_track,sort_order,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(wedding_id,id) DO UPDATE SET name=excluded.name,time=excluded.time,place=excluded.place,destination=excluded.destination,note=excluded.note,linked_event_id=excluded.linked_event_id,pickup_json=excluded.pickup_json,destination_json=excluded.destination_json,organiser_can_track=excluded.organiser_can_track,sort_order=excluded.sort_order,updated_at=excluded.updated_at`,[
     id,journey.id,String(journey.name).slice(0,120),String(journey.time||'').slice(0,20),String(journey.place||'').slice(0,300),String(journey.destination||'').slice(0,300)||null,String(journey.note||'').slice(0,1000),String(journey.linkedEventId||'')||null,journey.pickupLocation?JSON.stringify(journey.pickupLocation):null,journey.destinationLocation?JSON.stringify(journey.destinationLocation):null,journey.organiserCanTrack?1:0,index,new Date().toISOString()
    ]);
   await d1Execute('DELETE FROM coach_trackers WHERE wedding_id=? AND journey_id=?',[id,journey.id]);
   for(const guestId of [...new Set(journey.trackerGuestIds??[])].slice(0,3)){
    const guestExists=(await d1Query<{id:string}>('SELECT id FROM guests WHERE id=? AND wedding_id=? LIMIT 1',[guestId,id]))[0];
    if(guestExists)await d1Execute('INSERT OR IGNORE INTO coach_trackers (wedding_id,journey_id,guest_id,created_at) VALUES (?,?,?,?)',[id,journey.id,guestId,new Date().toISOString()]);
   }
  }
  return NextResponse.json({ok:true,count:journeys.length});
 }catch(error){
  console.error('Coach tracking PUT failed',error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not save coach setup'},{status:500});
 }
}

export async function PATCH(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const [guest,organiserSession]=await Promise.all([currentGuestSession(),currentOrganiserSession()]);
  const organiser=await organiserCanAccessWedding(organiserSession,slug);
  const guestAllowed=!!guest&&guest.weddingId===id&&guest.weddingSlug===slug;
  if(!organiser&&!guestAllowed)return NextResponse.json({ok:false,error:'Join this wedding to share coach location.'},{status:401});
  await ensureTables();

  const body=await request.json() as {journeyId?:string;action?:string;lat?:number;lng?:number;accuracy?:number};
  const journeyId=String(body.journeyId||'');
  const action=String(body.action||'');
  const journey=(await d1Query<JourneyRow>('SELECT id,name,time,place,destination,note,linked_event_id,pickup_json,destination_json,organiser_can_track,sort_order FROM coach_journeys WHERE wedding_id=? AND id=? LIMIT 1',[id,journeyId]))[0];
  if(!journey)return NextResponse.json({ok:false,error:'Coach journey not found'},{status:404});

  const guestAssignment=guestAllowed?(await d1Query<{guest_id:string}>('SELECT guest_id FROM coach_trackers WHERE wedding_id=? AND journey_id=? AND guest_id=? LIMIT 1',[id,journeyId,guest!.guestId]))[0]:null;
  const guestAssigned=!!guestAssignment;
  const organiserAssigned=organiser&&Boolean(journey.organiser_can_track);
  if(!guestAssigned&&!organiserAssigned)return NextResponse.json({ok:false,error:'You are not a nominated tracker for this coach.'},{status:403});

  const now=new Date().toISOString();
  const trackerId=guestAssigned?guest!.guestId:null;

  if(action==='start'||action==='position'){
   const lat=validCoordinate(body.lat,-90,90);
   const lng=validCoordinate(body.lng,-180,180);
   const accuracy=Number.isFinite(Number(body.accuracy))?Math.max(0,Number(body.accuracy)):null;
   if(lat==null||lng==null)return NextResponse.json({ok:false,error:'A valid location is required.'},{status:400});

   if(action==='position'&&trackerId){
    const current=(await d1Query<LiveRow>('SELECT journey_id,status,lat,lng,accuracy,tracker_guest_id,started_at,updated_at,arrived_at FROM coach_live_state WHERE wedding_id=? AND journey_id=? LIMIT 1',[id,journeyId]))[0];
    if(current?.status==='tracking'&&current.tracker_guest_id&&current.tracker_guest_id!==guest!.guestId){
     return NextResponse.json({ok:false,error:'Another nominated tracker has taken over this coach.'},{status:409});
    }
   }

   await d1Execute(`INSERT INTO coach_live_state (wedding_id,journey_id,status,lat,lng,accuracy,tracker_guest_id,started_at,updated_at,arrived_at)
    VALUES (?,?,?,?,?,?,?,?,?,NULL)
    ON CONFLICT(wedding_id,journey_id) DO UPDATE SET status='tracking',lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,tracker_guest_id=excluded.tracker_guest_id,started_at=CASE WHEN ?='start' THEN excluded.started_at ELSE COALESCE(coach_live_state.started_at,excluded.started_at) END,updated_at=excluded.updated_at,arrived_at=NULL`,[
     id,journeyId,'tracking',lat,lng,accuracy,trackerId,now,now,action
    ]);
   return NextResponse.json({ok:true,status:'tracking',updatedAt:now});
  }

  if(action==='arrive'){
   await d1Execute(`INSERT INTO coach_live_state (wedding_id,journey_id,status,lat,lng,accuracy,tracker_guest_id,started_at,updated_at,arrived_at)
    VALUES (?,?, 'arrived',NULL,NULL,NULL,?,NULL,?,?)
    ON CONFLICT(wedding_id,journey_id) DO UPDATE SET status='arrived',lat=NULL,lng=NULL,accuracy=NULL,tracker_guest_id=excluded.tracker_guest_id,updated_at=excluded.updated_at,arrived_at=excluded.arrived_at`,[id,journeyId,trackerId,now,now]);
   try{
    await publishWeddingNotification({
     weddingId:id,
     type:'coach',
     title:`${journey.name} has arrived 🚌`,
     message:`The coach has reached ${journey.destination||'its destination'}.`,
     url:`/wedding/${encodeURIComponent(slug)}/travel`,
     sourceId:`coach-arrived:${journeyId}:${now}`
    });
   }catch(notificationError){console.error('Coach arrival notification failed',notificationError)}
   return NextResponse.json({ok:true,status:'arrived',arrivedAt:now});
  }

  if(action==='stop'){
   await d1Execute(`INSERT INTO coach_live_state (wedding_id,journey_id,status,lat,lng,accuracy,tracker_guest_id,started_at,updated_at,arrived_at)
    VALUES (?,?, 'idle',NULL,NULL,NULL,NULL,NULL,?,NULL)
    ON CONFLICT(wedding_id,journey_id) DO UPDATE SET status='idle',lat=NULL,lng=NULL,accuracy=NULL,tracker_guest_id=NULL,started_at=NULL,updated_at=excluded.updated_at,arrived_at=NULL`,[id,journeyId,now]);
   return NextResponse.json({ok:true,status:'idle'});
  }

  return NextResponse.json({ok:false,error:'Unknown coach tracking action.'},{status:400});
 }catch(error){
  console.error('Coach tracking PATCH failed',error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not update coach tracking'},{status:500});
 }
}
