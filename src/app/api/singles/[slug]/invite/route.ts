import {NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../../lib/d1';
import {currentGuestSession} from '../../../../../lib/guestSession';
import {publishWeddingNotification} from '../../../../../lib/notifications';

type WeddingRow={id:string};
type InviteRow={id:string;sender_guest_id:string;sender_name:string;created_at:string};

async function ensureTable(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS singles_invites (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL,
  sender_guest_id TEXT NOT NULL,
  recipient_guest_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(wedding_id,sender_guest_id,recipient_guest_id),
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_singles_invites_recipient ON singles_invites(wedding_id,recipient_guest_id,created_at DESC)');
}
async function weddingId(slug:string){
 return (await d1Query<WeddingRow>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0]?.id??null;
}

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const session=await currentGuestSession();
  if(!session||session.weddingId!==id||session.weddingSlug!==slug)return NextResponse.json({ok:true,invites:[]});
  await ensureTable();
  const rows=await d1Query<InviteRow>(`SELECT i.id,i.sender_guest_id,g.name AS sender_name,i.created_at
   FROM singles_invites i
   JOIN guests g ON g.id=i.sender_guest_id AND g.wedding_id=i.wedding_id
   WHERE i.wedding_id=? AND i.recipient_guest_id=?
   ORDER BY i.created_at DESC LIMIT 20`,[id,session.guestId]);
  return NextResponse.json({ok:true,invites:rows.map(row=>({id:row.id,senderGuestId:row.sender_guest_id,senderName:row.sender_name,createdAt:row.created_at}))});
 }catch(error){
  console.error('Singles invites GET failed',error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load Singles invitations'},{status:500});
 }
}

export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const session=await currentGuestSession();
  if(!session||session.weddingId!==id||session.weddingSlug!==slug)return NextResponse.json({ok:false,error:'Join this wedding before inviting someone to Singles.'},{status:401});

  const body=await request.json() as {guestId?:string};
  const recipientGuestId=String(body.guestId||'');
  if(!recipientGuestId)return NextResponse.json({ok:false,error:'Choose a guest first.'},{status:400});
  if(recipientGuestId===session.guestId)return NextResponse.json({ok:false,error:'You can join Singles directly from this page.'},{status:400});

  const recipient=(await d1Query<{id:string;name:string}>('SELECT id,name FROM guests WHERE id=? AND wedding_id=? LIMIT 1',[recipientGuestId,id]))[0];
  if(!recipient)return NextResponse.json({ok:false,error:'Guest not found.'},{status:404});
  const alreadyJoined=(await d1Query<{id:string}>('SELECT id FROM singles_profiles WHERE wedding_id=? AND guest_id=? AND opted_in=1 LIMIT 1',[id,recipientGuestId]))[0];
  if(alreadyJoined)return NextResponse.json({ok:false,error:`${recipient.name} has already joined Singles.`},{status:409});

  await ensureTable();
  const existing=(await d1Query<{id:string}>('SELECT id FROM singles_invites WHERE wedding_id=? AND sender_guest_id=? AND recipient_guest_id=? LIMIT 1',[id,session.guestId,recipientGuestId]))[0];
  if(existing)return NextResponse.json({ok:true,alreadySent:true,recipient:{id:recipient.id,name:recipient.name}});
  const inviteId=crypto.randomUUID();
  const now=new Date().toISOString();
  await d1Execute('INSERT OR IGNORE INTO singles_invites (id,wedding_id,sender_guest_id,recipient_guest_id,created_at) VALUES (?,?,?,?,?)',[inviteId,id,session.guestId,recipientGuestId,now]);

  try{
   await publishWeddingNotification({
    weddingId:id,
    recipientGuestId,
    type:'singles-invite',
    title:'A little wedding nudge 💌',
    message:`${session.guestName} invited you to take a look at Milni Singles. Nothing is shared unless you choose to join.`,
    url:`/wedding/${encodeURIComponent(slug)}/singles`,
    sourceId:`singles-invite:${session.guestId}:${recipientGuestId}`
   });
  }catch(notificationError){console.error('Singles invite notification failed',notificationError)}

  return NextResponse.json({ok:true,recipient:{id:recipient.id,name:recipient.name}});
 }catch(error){
  console.error('Singles invites POST failed',error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not send Singles invitation'},{status:500});
 }
}
