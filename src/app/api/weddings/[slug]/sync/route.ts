import {NextRequest,NextResponse} from 'next/server';
import {d1Execute} from '../../../../../../lib/d1';

type Event={id:string;start:string;end:string;name:string;description:string;type:string;location?:string};
type Day={id:string;label:string;date:string;events:Event[]};
type Album={id:string;name:string;description:string;eventId?:string};
type Guest={id:string;name:string;group:string;status:string;side?:string;email?:string;phone?:string;dietary?:string;plusOne?:string;notes?:string};
type Draft={partnerOne:string;partnerTwo:string;title:string;city:string;startDate:string;endDate:string;schedule?:Day[];photoAlbums?:Album[];guests?:Guest[]};

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const draft=await request.json() as Draft;
  const weddingId=`wedding-${slug}`;
  await d1Execute(`INSERT INTO weddings (id,slug,partner_one,partner_two,title,city,start_date,end_date,updated_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(slug) DO UPDATE SET partner_one=excluded.partner_one,partner_two=excluded.partner_two,title=excluded.title,city=excluded.city,start_date=excluded.start_date,end_date=excluded.end_date,updated_at=CURRENT_TIMESTAMP`,[weddingId,slug,draft.partnerOne||'',draft.partnerTwo||'',draft.title||'',draft.city||'',draft.startDate||'',draft.endDate||'']);
  for(const guest of draft.guests??[])await d1Execute(`INSERT INTO guests (id,wedding_id,name,email,phone,guest_group,rsvp_status,wedding_side,dietary,plus_one,organiser_notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,guest_group=excluded.guest_group,rsvp_status=excluded.rsvp_status,wedding_side=excluded.wedding_side,dietary=excluded.dietary,plus_one=excluded.plus_one,organiser_notes=excluded.organiser_notes,updated_at=CURRENT_TIMESTAMP`,[guest.id,weddingId,guest.name,guest.email??null,guest.phone??null,guest.group,guest.status,guest.side??null,guest.dietary??null,guest.plusOne??null,guest.notes??null]);
  let order=0;
  for(const day of draft.schedule??[])for(const event of day.events){await d1Execute(`INSERT INTO events (id,wedding_id,day_label,event_date,name,description,event_type,start_time,end_time,location,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET day_label=excluded.day_label,event_date=excluded.event_date,name=excluded.name,description=excluded.description,event_type=excluded.event_type,start_time=excluded.start_time,end_time=excluded.end_time,location=excluded.location,sort_order=excluded.sort_order,updated_at=CURRENT_TIMESTAMP`,[event.id,weddingId,day.label,day.date,event.name,event.description,event.type,event.start,event.end,event.location??null,order++]);}
  for(const album of draft.photoAlbums??[])await d1Execute(`INSERT INTO photo_albums (id,wedding_id,event_id,name,description,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id,name=excluded.name,description=excluded.description,updated_at=CURRENT_TIMESTAMP`,[album.id,weddingId,album.eventId??null,album.name,album.description]);
  return NextResponse.json({ok:true,weddingId,events:order,albums:(draft.photoAlbums??[]).length,guests:(draft.guests??[]).length});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Wedding sync failed'},{status:500})}
}
