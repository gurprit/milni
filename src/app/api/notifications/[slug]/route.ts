import {NextResponse} from 'next/server';
import {currentGuestSession} from '../../../../lib/guestSession';
import {listGuestNotifications,markGuestNotificationsRead} from '../../../../lib/notifications';

async function sessionFor(slug:string){
 const session=await currentGuestSession();
 if(!session)return null;
 return session.weddingSlug===slug?session:null;
}

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const session=await sessionFor(slug);
  if(!session)return NextResponse.json({ok:false,error:'Guest access required.'},{status:401});
  const notifications=await listGuestNotifications(session.weddingId,session.guestId);
  return NextResponse.json({
   ok:true,
   notifications,
   unreadCount:notifications.filter(item=>!item.read_at).length,
  });
 }catch(error){
  console.error('Notifications GET failed',error);
  return NextResponse.json({ok:false,error:'Could not load notifications.'},{status:500});
 }
}

export async function PATCH(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params;
  const session=await sessionFor(slug);
  if(!session)return NextResponse.json({ok:false,error:'Guest access required.'},{status:401});
  const body=await request.json().catch(()=>({})) as {id?:string};
  await markGuestNotificationsRead(session.weddingId,session.guestId,body.id?String(body.id):undefined);
  return NextResponse.json({ok:true});
 }catch(error){
  console.error('Notifications PATCH failed',error);
  return NextResponse.json({ok:false,error:'Could not update notifications.'},{status:500});
 }
}
