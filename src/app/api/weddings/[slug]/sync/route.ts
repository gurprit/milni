import {NextRequest,NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../../lib/d1';
import {currentOrganiserSession} from '../../../../../lib/organiserSession';
import {organiserCanAccessWedding} from '../../../../../lib/organiserAccounts';

type Event={id:string;start:string;end:string;name:string;description:string;type:string;location?:string;locationInfo?:{name:string;formattedAddress:string;lat?:number;lng?:number;placeId?:string};rsvpEnabled?:boolean;inviteMode?:string;invitedGroups?:string[];invitedGuestIds?:string[]};
type Day={id:string;label:string;date:string;events:Event[]};
type Album={id:string;name:string;description:string;eventId?:string};
type Guest={id:string;name:string;group:string;status:string;side?:string;email?:string;phone?:string;dietary?:string;plusOne?:string;notes?:string};
type Draft={partnerOne:string;partnerTwo:string;title:string;city:string;startDate:string;endDate:string;inviteHeroKey?:string;inviteHeroUrl?:string;schedule?:Day[];photoAlbums?:Album[];guests?:Guest[]};

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{
  const organiser=await currentOrganiserSession();
  const{slug}=await params;
  if(!await organiserCanAccessWedding(organiser,slug))return NextResponse.json({ok:false,error:'Organiser access required for this wedding.'},{status:403});
  const draft=await request.json() as Draft;
  try{await d1Execute('ALTER TABLE weddings ADD COLUMN invite_hero_key TEXT')}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN rsvp_enabled INTEGER NOT NULL DEFAULT 1')}catch{}
  try{await d1Execute("ALTER TABLE events ADD COLUMN invite_mode TEXT NOT NULL DEFAULT 'Everyone'")}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN invited_groups TEXT')}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN invited_guest_ids TEXT')}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN location_name TEXT')}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN location_lat REAL')}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN location_lng REAL')}catch{}
  try{await d1Execute('ALTER TABLE events ADD COLUMN location_place_id TEXT')}catch{}
  const proposedWeddingId=`wedding-${slug}`;
  await d1Execute(`INSERT INTO weddings (id,slug,partner_one,partner_two,title,city,start_date,end_date,invite_hero_key,updated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(slug) DO UPDATE SET partner_one=excluded.partner_one,partner_two=excluded.partner_two,title=excluded.title,city=excluded.city,start_date=excluded.start_date,end_date=excluded.end_date,invite_hero_key=excluded.invite_hero_key,updated_at=CURRENT_TIMESTAMP`,[proposedWeddingId,slug,draft.partnerOne||'',draft.partnerTwo||'',draft.title||'',draft.city||'',draft.startDate||'',draft.endDate||'',draft.inviteHeroKey??null]);
  const weddingRow=(await d1Query<{id:string}>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0];
  if(!weddingRow)throw new Error('Wedding could not be resolved after sync');
  const weddingId=weddingRow.id;
  const incomingGuestIds=(draft.guests??[]).map(guest=>guest.id);
  const existingGuests=await d1Query<{id:string}>('SELECT id FROM guests WHERE wedding_id=?',[weddingId]);
  for(const existing of existingGuests)if(!incomingGuestIds.includes(existing.id))await d1Execute('DELETE FROM guests WHERE id=? AND wedding_id=?',[existing.id,weddingId]);
  for(const guest of draft.guests??[])await d1Execute(`INSERT INTO guests (id,wedding_id,name,email,phone,guest_group,rsvp_status,wedding_side,dietary,plus_one,organiser_notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET wedding_id=excluded.wedding_id,name=excluded.name,email=excluded.email,phone=excluded.phone,guest_group=excluded.guest_group,rsvp_status=excluded.rsvp_status,wedding_side=excluded.wedding_side,dietary=excluded.dietary,plus_one=excluded.plus_one,organiser_notes=excluded.organiser_notes,updated_at=CURRENT_TIMESTAMP`,[guest.id,weddingId,guest.name,guest.email??null,guest.phone??null,guest.group,guest.status,guest.side??null,guest.dietary??null,guest.plusOne??null,guest.notes??null]);
  const incomingEventIds=(draft.schedule??[]).flatMap(day=>day.events.map(event=>event.id));
  const existingEvents=await d1Query<{id:string}>('SELECT id FROM events WHERE wedding_id=?',[weddingId]);
  for(const existing of existingEvents)if(!incomingEventIds.includes(existing.id))await d1Execute('DELETE FROM events WHERE id=? AND wedding_id=?',[existing.id,weddingId]);
  let order=0;
  for(const day of draft.schedule??[])for(const event of day.events){await d1Execute(`INSERT INTO events (id,wedding_id,day_label,event_date,name,description,event_type,start_time,end_time,location,location_name,location_lat,location_lng,location_place_id,rsvp_enabled,invite_mode,invited_groups,invited_guest_ids,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET day_label=excluded.day_label,event_date=excluded.event_date,name=excluded.name,description=excluded.description,event_type=excluded.event_type,start_time=excluded.start_time,end_time=excluded.end_time,location=excluded.location,location_name=excluded.location_name,location_lat=excluded.location_lat,location_lng=excluded.location_lng,location_place_id=excluded.location_place_id,rsvp_enabled=excluded.rsvp_enabled,invite_mode=excluded.invite_mode,invited_groups=excluded.invited_groups,invited_guest_ids=excluded.invited_guest_ids,sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP`,[event.id,weddingId,day.label,day.date,event.name,event.description,event.type,event.start,event.end,event.location??null,event.locationInfo?.name??null,event.locationInfo?.lat??null,event.locationInfo?.lng??null,event.locationInfo?.placeId??null,event.rsvpEnabled===false?0:1,event.inviteMode??'Everyone',JSON.stringify(event.invitedGroups??[]),JSON.stringify(event.invitedGuestIds??[]),order++]);}
  const resolvedAlbums=[...(draft.photoAlbums??[])];
  for(const day of draft.schedule??[])for(const event of day.events){
   if(!resolvedAlbums.some(album=>album.eventId===event.id)){
    resolvedAlbums.push({id:`album-${event.id}`,name:event.name,description:`Photos from ${event.name}`,eventId:event.id});
   }
  }
  const incomingAlbumIds=resolvedAlbums.map(album=>album.id);
  const existingAlbums=await d1Query<{id:string}>('SELECT id FROM photo_albums WHERE wedding_id=?',[weddingId]);
  for(const existing of existingAlbums)if(!incomingAlbumIds.includes(existing.id))await d1Execute('DELETE FROM photo_albums WHERE id=? AND wedding_id=?',[existing.id,weddingId]);
  for(const album of resolvedAlbums)await d1Execute(`INSERT INTO photo_albums (id,wedding_id,event_id,name,description,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id,name=excluded.name,description=excluded.description,updated_at=CURRENT_TIMESTAMP`,[album.id,weddingId,album.eventId??null,album.name,album.description]);
  return NextResponse.json({ok:true,weddingId,events:order,albums:resolvedAlbums.length,guests:(draft.guests??[]).length});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Wedding sync failed'},{status:500})}
}
