import {NextResponse} from 'next/server';
import {currentGuestSession} from '../../../../lib/guestSession';
import {removePushSubscription,savePushSubscription} from '../../../../lib/notifications';

type SubscriptionBody={
 slug?:string;
 subscription?:{
  endpoint?:string;
  keys?:{p256dh?:string;auth?:string};
 };
};

function validEndpoint(value:string){
 try{return new URL(value).protocol==='https:'}catch{return false}
}

export async function POST(request:Request){
 try{
  const session=await currentGuestSession();
  if(!session)return NextResponse.json({ok:false,error:'Join the wedding before enabling notifications.'},{status:401});
  const body=await request.json() as SubscriptionBody;
  if(String(body.slug||'')!==session.weddingSlug)return NextResponse.json({ok:false,error:'This notification subscription belongs to a different wedding.'},{status:403});
  const endpoint=String(body.subscription?.endpoint||'').slice(0,2500);
  const p256dh=String(body.subscription?.keys?.p256dh||'').slice(0,500);
  const auth=String(body.subscription?.keys?.auth||'').slice(0,500);
  if(!validEndpoint(endpoint)||!p256dh||!auth)return NextResponse.json({ok:false,error:'The browser did not provide a valid push subscription.'},{status:400});
  await savePushSubscription({weddingId:session.weddingId,guestId:session.guestId,endpoint,p256dh,auth});
  return NextResponse.json({ok:true});
 }catch(error){
  console.error('Push subscribe failed',error);
  return NextResponse.json({ok:false,error:'Could not enable push notifications.'},{status:500});
 }
}

export async function DELETE(request:Request){
 try{
  const session=await currentGuestSession();
  if(!session)return NextResponse.json({ok:true});
  const body=await request.json() as {endpoint?:string};
  const endpoint=String(body.endpoint||'');
  if(endpoint)await removePushSubscription(endpoint);
  return NextResponse.json({ok:true});
 }catch(error){
  console.error('Push unsubscribe failed',error);
  return NextResponse.json({ok:false,error:'Could not disable push notifications.'},{status:500});
 }
}
