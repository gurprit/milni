import {NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../lib/d1';
import {GUEST_COOKIE,currentGuestSession,encodeGuestSession} from '../../../lib/guestSession';
import {invitationCode} from '../../../lib/weddingDraft';

type Wedding={id:string;slug:string;partner_one:string;partner_two:string;start_date:string|null};
type Guest={id:string;name:string;email?:string|null;phone?:string|null;guest_group?:string|null;rsvp_status?:string|null;wedding_side?:string|null;dietary?:string|null;plus_one?:string|null;invite_token?:string|null};

const normaliseEmail=(value:unknown)=>String(value??'').trim().toLowerCase();
const normalisePhone=(value:unknown)=>{
 const digits=String(value??'').replace(/\D/g,'');
 const international=digits.startsWith('00')?digits.slice(2):digits;
 return international.length>10?international.slice(-10):international;
};
const contactMatches=(guest:Guest,contact:unknown)=>{
 const value=String(contact??'').trim();
 if(!value)return false;
 if(value.includes('@'))return !!guest.email&&normaliseEmail(guest.email)===normaliseEmail(value);
 const phone=normalisePhone(value);
 return !!phone&&!!guest.phone&&normalisePhone(guest.phone)===phone;
};
const codeFor=(wedding:Wedding)=>invitationCode({partnerOne:wedding.partner_one,partnerTwo:wedding.partner_two,startDate:wedding.start_date??'',endDate:'',city:'',title:'',traditions:[]});

export async function GET(request:Request){
 const session=await currentGuestSession();
 if(!session)return NextResponse.json({ok:true,guest:null});
 try{await d1Execute('ALTER TABLE guests ADD COLUMN invite_token TEXT')}catch{}
 const guest=(await d1Query<Guest>('SELECT id,name,guest_group,rsvp_status,wedding_side,dietary,plus_one,invite_token FROM guests WHERE id=? AND wedding_id=? LIMIT 1',[session.guestId,session.weddingId]))[0];
 if(!guest)return NextResponse.json({ok:true,guest:null});
 const origin=new URL(request.url).origin;
 return NextResponse.json({ok:true,guest:{id:guest.id,name:guest.name,weddingSlug:session.weddingSlug,group:guest.guest_group??'',status:guest.rsvp_status??'Awaiting RSVP',side:guest.wedding_side??'',dietary:guest.dietary??'',plusOne:guest.plus_one??'',inviteLink:guest.invite_token?`${origin}/invite/${session.weddingSlug}?token=${encodeURIComponent(guest.invite_token)}`:null}});
}

export async function POST(request:Request){
 try{
  const{slug,contact,code,token,guestId}=await request.json();
  let wedding:Wedding|undefined;
  let guest:Guest|undefined;

  if(token){
   try{await d1Execute('ALTER TABLE guests ADD COLUMN invite_token TEXT')}catch{}
   const rows=await d1Query<Guest&{wedding_id:string;slug:string;partner_one:string;partner_two:string;start_date:string|null}>(`SELECT g.id,g.name,g.wedding_id,w.slug,w.partner_one,w.partner_two,w.start_date FROM guests g JOIN weddings w ON w.id=g.wedding_id WHERE g.invite_token=? LIMIT 1`,[String(token)]);
   const row=rows[0];
   if(!row)return NextResponse.json({ok:false,error:'This invitation link is invalid or has been replaced.'},{status:401});
   wedding={id:row.wedding_id,slug:row.slug,partner_one:row.partner_one,partner_two:row.partner_two,start_date:row.start_date};
   guest={id:row.id,name:row.name};
  }else{
   const suppliedCode=String(code||'').trim().toUpperCase();
   if(!suppliedCode)return NextResponse.json({ok:false,error:'Enter the wedding code.'},{status:400});
   if(!String(contact||'').trim())return NextResponse.json({ok:false,error:'Enter your email address or mobile number.'},{status:400});

   if(slug){
    wedding=(await d1Query<Wedding>('SELECT id,slug,partner_one,partner_two,start_date FROM weddings WHERE slug=? LIMIT 1',[String(slug)]))[0];
    if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found.'},{status:404});
    if(suppliedCode!==codeFor(wedding))return NextResponse.json({ok:false,error:'That wedding code does not match this wedding.'},{status:401});
   }else{
    const weddings=await d1Query<Wedding>('SELECT id,slug,partner_one,partner_two,start_date FROM weddings');
    const matches=weddings.filter(w=>suppliedCode===codeFor(w));
    if(matches.length!==1)return NextResponse.json({ok:false,error:matches.length?'That code matches more than one wedding. Please scan the wedding QR or use the wedding link.':'We could not find a wedding with that code.'},{status:401});
    wedding=matches[0];
   }

   const guests=await d1Query<Guest>('SELECT id,name,email,phone,guest_group,rsvp_status,wedding_side,dietary,plus_one FROM guests WHERE wedding_id=?',[wedding.id]);
   const matches=guests.filter(candidate=>contactMatches(candidate,contact));
   if(!matches.length)return NextResponse.json({ok:false,error:'We could not match that email address or mobile number to this wedding guest list.'},{status:401});

   if(guestId){
    guest=matches.find(candidate=>candidate.id===String(guestId));
    if(!guest)return NextResponse.json({ok:false,error:'That guest is not linked to the contact details you entered.'},{status:401});
   }else if(matches.length>1){
    return NextResponse.json({ok:false,requiresGuestSelection:true,weddingSlug:wedding.slug,candidates:matches.map(candidate=>({id:candidate.id,name:candidate.name,group:candidate.guest_group??''}))},{status:409});
   }else{
    guest=matches[0];
   }
  }

  const expiresAt=Date.now()+1000*60*60*24*30;
  const response=NextResponse.json({ok:true,weddingSlug:wedding.slug,guest:{id:guest.id,name:guest.name}});
  response.cookies.set(GUEST_COOKIE,encodeGuestSession({weddingId:wedding.id,weddingSlug:wedding.slug,guestId:guest.id,guestName:guest.name,expiresAt}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30});
  return response;
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not join wedding.'},{status:500});
 }
}

export async function DELETE(){
 const response=NextResponse.json({ok:true});
 response.cookies.set(GUEST_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
 return response;
}

export async function PATCH(request:Request){
 try{
  const session=await currentGuestSession();
  if(!session)return NextResponse.json({ok:false,error:'Please join the wedding first.'},{status:401});
  const body=await request.json();
  const status=String(body.status??'').trim();
  const dietary=String(body.dietary??'').trim().slice(0,500);
  const allowed=['Going','Not going','Awaiting RSVP'];
  if(!allowed.includes(status))return NextResponse.json({ok:false,error:'Choose a valid RSVP status.'},{status:400});
  const guest=(await d1Query<Guest>('SELECT id FROM guests WHERE id=? AND wedding_id=? LIMIT 1',[session.guestId,session.weddingId]))[0];
  if(!guest)return NextResponse.json({ok:false,error:'Guest record not found.'},{status:404});
  await d1Execute('UPDATE guests SET rsvp_status=?,dietary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND wedding_id=?',[status,dietary||null,session.guestId,session.weddingId]);
  return NextResponse.json({ok:true,guest:{id:session.guestId,status,dietary}});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not update RSVP.'},{status:500});
 }
}
