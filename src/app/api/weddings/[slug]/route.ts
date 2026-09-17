import {NextResponse} from 'next/server';
import {d1Query} from '../../../../lib/d1';

type WeddingRow={id:string;slug:string;partner_one:string;partner_two:string;title:string|null;city:string|null;start_date:string|null;end_date:string|null};
type EventRow={id:string;day_label:string|null;event_date:string|null;name:string;description:string|null;event_type:string|null;start_time:string|null;end_time:string|null;location:string|null;sort_order:number};
type AlbumRow={id:string;event_id:string|null;name:string;description:string|null;cover_object_key:string|null};
type GuestRow={id:string;name:string;email:string|null;phone:string|null;guest_group:string|null;rsvp_status:string;wedding_side:string|null;dietary:string|null;plus_one:string|null;organiser_notes:string|null};

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const weddings=await d1Query<WeddingRow>('SELECT id,slug,partner_one,partner_two,title,city,start_date,end_date FROM weddings WHERE slug=? LIMIT 1',[slug]);
  const wedding=weddings[0];
  if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const[events,albums,guests]=await Promise.all([
   d1Query<EventRow>('SELECT id,day_label,event_date,name,description,event_type,start_time,end_time,location,sort_order FROM events WHERE wedding_id=? ORDER BY sort_order,event_date,start_time',[wedding.id]),
   d1Query<AlbumRow>('SELECT id,event_id,name,description,cover_object_key FROM photo_albums WHERE wedding_id=? ORDER BY created_at,id',[wedding.id]),
   d1Query<GuestRow>('SELECT id,name,email,phone,guest_group,rsvp_status,wedding_side,dietary,plus_one,organiser_notes FROM guests WHERE wedding_id=? ORDER BY name',[wedding.id])
  ]);
  const days=new Map<string,{id:string;label:string;date:string;events:{id:string;start:string;end:string;name:string;description:string;type:string;location?:string}[]}>();
  for(const event of events){const date=event.event_date??'';const label=event.day_label??'Wedding day';const key=`${date}|${label}`;if(!days.has(key))days.set(key,{id:`day-${date||label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,label,date,events:[]});days.get(key)!.events.push({id:event.id,start:event.start_time??'',end:event.end_time??'',name:event.name,description:event.description??'',type:event.event_type??'Celebration',...(event.location?{location:event.location}:{})})}
  return NextResponse.json({ok:true,draft:{partnerOne:wedding.partner_one,partnerTwo:wedding.partner_two,title:wedding.title??'',city:wedding.city??'',startDate:wedding.start_date??'',endDate:wedding.end_date??'',schedule:[...days.values()],photoAlbums:albums.map(album=>({id:album.id,name:album.name,description:album.description??'',...(album.event_id?{eventId:album.event_id}:{}),...(album.cover_object_key?{coverUrl:`/api/media?key=${encodeURIComponent(album.cover_object_key)}`}:{})})),guests:guests.map(guest=>({id:guest.id,name:guest.name,group:guest.guest_group??'',status:guest.rsvp_status,side:guest.wedding_side??undefined,email:guest.email??undefined,phone:guest.phone??undefined,dietary:guest.dietary??undefined,plusOne:guest.plus_one??undefined,notes:guest.organiser_notes??undefined}))}});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Wedding load failed'},{status:500})}
}
