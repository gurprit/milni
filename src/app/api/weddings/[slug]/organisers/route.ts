import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {currentOrganiserSession,encodeOrganiserSession,ORGANISER_COOKIE} from '../../../../../lib/organiserSession';
import {d1Execute,d1Query} from '../../../../../lib/d1';
import {ensureOrganiserSchema,organiserCanAccessWedding} from '../../../../../lib/organiserAccounts';

type Row={user_id:string;name:string;email:string;phone:string|null;role:string;status:string;claim_token:string|null};
function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const session=await currentOrganiserSession();
  if(!await organiserCanAccessWedding(session,slug))return NextResponse.json({ok:false,error:'Organiser access required.'},{status:403});
  await ensureOrganiserSchema();
  const wedding=(await d1Query<{id:string}>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0];
  if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found.'},{status:404});
  const rows=await d1Query<Row>(`SELECT u.id AS user_id,u.name,u.email,u.phone,wo.role,wo.status,wo.claim_token
    FROM wedding_organisers wo
    JOIN organiser_users u ON u.id=wo.user_id
    WHERE wo.wedding_id=?
    ORDER BY CASE wo.role WHEN 'partner-one' THEN 1 WHEN 'partner-two' THEN 2 ELSE 3 END,u.name`,[wedding.id]);
  const origin=new URL(request.url).origin;
  return NextResponse.json({ok:true,organisers:rows.map(row=>({
   id:row.user_id,name:row.name,email:row.email,phone:row.phone??'',role:row.role,status:row.status,
   claimUrl:row.claim_token?`${origin}/organiser/claim/${encodeURIComponent(row.claim_token)}`:null
  }))});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load organisers.'},{status:500})}
}

export async function PATCH(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const session=await currentOrganiserSession();
  if(!await organiserCanAccessWedding(session,slug))return NextResponse.json({ok:false,error:'Organiser access required.'},{status:403});
  await ensureOrganiserSchema();

  const wedding=(await d1Query<{id:string}>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0];
  if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found.'},{status:404});

  const body=await request.json();
  const userId=String(body.userId||'').trim();
  const name=String(body.name||'').trim();
  const email=String(body.email||'').trim().toLowerCase();
  const phone=String(body.phone||'').trim();
  if(!userId||!name)return NextResponse.json({ok:false,error:'Add a name for this organiser.'},{status:400});
  if(!validEmail(email))return NextResponse.json({ok:false,error:'Add a valid organiser email address.'},{status:400});

  const membership=(await d1Query<{role:string;status:string;claim_token:string|null}>(`SELECT role,status,claim_token
    FROM wedding_organisers
    WHERE wedding_id=? AND user_id=?
    LIMIT 1`,[wedding.id,userId]))[0];
  if(!membership)return NextResponse.json({ok:false,error:'That organiser does not belong to this wedding.'},{status:404});

  const duplicate=(await d1Query<{id:string}>('SELECT id FROM organiser_users WHERE lower(email)=lower(?) AND id<>? LIMIT 1',[email,userId]))[0];
  if(duplicate)return NextResponse.json({ok:false,error:'That email address already belongs to another organiser account.'},{status:409});

  await d1Execute('UPDATE organiser_users SET name=?,email=?,phone=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[name,email,phone||null,userId]);
  if(session?.userId===userId){
   const expiresAt=session.expiresAt;
   (await cookies()).set(ORGANISER_COOKIE,encodeOrganiserSession({email,userId,expiresAt}),{
    httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(expiresAt)
   });
  }

  const origin=new URL(request.url).origin;
  return NextResponse.json({ok:true,organiser:{
   id:userId,name,email,phone,role:membership.role,status:membership.status,
   claimUrl:membership.claim_token?`${origin}/organiser/claim/${encodeURIComponent(membership.claim_token)}`:null
  }});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not update organiser.'},{status:500})}
}
