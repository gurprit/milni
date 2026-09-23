import {NextResponse} from 'next/server';
import {d1Query} from '../../../../lib/d1';
import {currentOrganiserSession} from '../../../../lib/organiserSession';
import {currentGuestSession} from '../../../../lib/guestSession';

type WeddingRow={id:string;slug:string;partner_one:string;partner_two:string;title:string|null;city:string|null;start_date:string|null;end_date:string|null;invite_hero_key?:string|null};
type EventRow={id:string;day_label:string|null;event_date:string|null;name:string;description:string|null;event_type:string|null;start_time:string|null;end_time:string|null;location:string|null;sort_order:number;rsvp_enabled?:number;invite_mode?:string;invited_groups?:string|null;invited_guest_ids?:string|null};
type AlbumRow={id:string;event_id:string|null;name:string;description:string|null;cover_object_key:string|null};
type GuestRow={id:string;name:string;email:string|null;phone:string|null;guest_group:string|null;rsvp_status:string;wedding_side:string|null;dietary:string|null;plus_one:string|null;organiser_notes:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  try{const {d1Execute}=await import('../../../../lib/d1');await d1Execute('ALTER TABLE events ADD COLUMN rsvp_enabled INTEGER NOT NULL DEFAULT 1');try{await d1Execute("ALTER TABLE events ADD COLUMN invite_mode TEXT NOT NULL DEFAULT 'Everyone'")}catch{}try{await d1Execute('ALTER TABLE events ADD COLUMN invited_groups TEXT')}catch{}try{await d1Execute('ALTER TABLE events ADD COLUMN invited_guest_ids TEXT')}catch{}}catch{}
  try{const {d1Execute}=await import('../../../../lib/d1');await d1Execute('ALTER TABLE weddings ADD COLUMN invite_hero_key TEXT')}catch{}
  const weddings=await d1Query<WeddingRow>('SELECT id,slug,partner_one,partner_two,title,city,start_date,end_date,invite_hero_key FROM weddings WHERE slug=? LIMIT 1',[slug]);
  const wedding=weddings[0];
  if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const organiser=await currentOrganiserSession();
  const guestSession=await currentGuestSession();
  const canSeePrivateGuests=Boolean(organiser);
  const[events,albums,guests]=await Promise.all([
   d1Query<EventRow>('SELECT id,day_label,event_date,name,description,event_type,start_time,end_time,location,rsvp_enabled,invite_mode,invited_groups,invited_guest_ids,sort_order FROM events WHERE wedding_id=? ORDER BY sort_order,event_date,start_time',[wedding.id]),
   d1Query<AlbumRow>('SELECT id,event_id,name,description,cover_object_key FROM photo_albums WHERE wedding_id=? ORDER BY created_at,id',[wedding.id]),
   canSeePrivateGuests?d1Query<GuestRow>('SELECT id,name,email,phone,guest_group,rsvp_status,wedding_side,dietary,plus_one,organiser_notes FROM guests WHERE wedding_id=? ORDER BY name',[wedding.id]):guestSession&&guestSession.weddingId===wedding.id?d1Query<GuestRow>('SELECT id,name,NULL AS email,NULL AS phone,guest_group,rsvp_status,wedding_side,NULL AS dietary,NULL AS plus_one,NULL AS organiser_notes FROM guests WHERE wedding_id=? ORDER BY name',[wedding.id]):Promise.resolve([] as GuestRow[])
  ]);
  const sessionGuest=guestSession&&guestSession.weddingId===wedding.id?(await d1Query<{id:string;guest_group:string|null;wedding_side:string|null}>('SELECT id,guest_group,wedding_side FROM guests WHERE id=? AND wedding_id=? LIMIT 1',[guestSession.guestId,wedding.id]))[0]:null;const visibleEvents=organiser?events:events.filter(event=>{const mode=event.invite_mode??'Everyone';if(mode==='Everyone')return true;if(!sessionGuest)return false;const groups:string[]=event.invited_groups?JSON.parse(event.invited_groups):[];const ids:string[]=event.invited_guest_ids?JSON.parse(event.invited_guest_ids):[];return(mode==='Partner one'&&(sessionGuest.wedding_side==='Partner one'||sessionGuest.wedding_side==='Both'))||(mode==='Partner two'&&(sessionGuest.wedding_side==='Partner two'||sessionGuest.wedding_side==='Both'))||(mode==='Groups'&&groups.includes(sessionGuest.guest_group??''))||(mode==='Custom'&&ids.includes(sessionGuest.id))});
  const days=new Map<string,{id:string;label:string;date:string;events:{id:string;start:string;end:string;name:string;description:string;type:string;location?:string;rsvpEnabled?:boolean;inviteMode?:string;invitedGroups?:string[];invitedGuestIds?:string[]}[]}>();
  for(const event of visibleEvents){const date=event.event_date??'';const label=event.day_label??'Wedding day';const key=`${date}|${label}`;if(!days.has(key))days.set(key,{id:`day-${date||label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,label,date,events:[]});days.get(key)!.events.push({id:event.id,start:event.start_time??'',end:event.end_time??'',name:event.name,description:event.description??'',type:event.event_type??'Celebration',...(event.location?{location:event.location}:{}),rsvpEnabled:event.rsvp_enabled!==0,inviteMode:event.invite_mode??'Everyone',invitedGroups:event.invited_groups?JSON.parse(event.invited_groups):[],invitedGuestIds:event.invited_guest_ids?JSON.parse(event.invited_guest_ids):[]})}
  return NextResponse.json({ok:true,draft:{partnerOne:wedding.partner_one,partnerTwo:wedding.partner_two,title:wedding.title??'',city:wedding.city??'',startDate:wedding.start_date??'',endDate:wedding.end_date??'',inviteHeroKey:wedding.invite_hero_key??undefined,inviteHeroUrl:wedding.invite_hero_key?`/api/media?key=${encodeURIComponent(wedding.invite_hero_key)}`:undefined,schedule:[...days.values()],photoAlbums:albums.map(album=>({id:album.id,name:album.name,description:album.description??'',...(album.event_id?{eventId:album.event_id}:{}),...(album.cover_object_key?{coverUrl:`/api/media?key=${encodeURIComponent(album.cover_object_key)}`}:{})})),guests:guests.map(guest=>({id:guest.id,name:guest.name,group:guest.guest_group??'',status:guest.rsvp_status,side:guest.wedding_side??undefined,email:guest.email??undefined,phone:guest.phone??undefined,dietary:guest.dietary??undefined,plusOne:guest.plus_one??undefined,notes:guest.organiser_notes??undefined}))}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Wedding load failed'},{status:500})}
}
