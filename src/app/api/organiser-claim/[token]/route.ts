import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {d1Execute,d1Query} from '../../../../lib/d1';
import {ensureOrganiserSchema,hashOrganiserPassword} from '../../../../lib/organiserAccounts';
import {encodeOrganiserSession,ORGANISER_COOKIE} from '../../../../lib/organiserSession';

type ClaimRow={user_id:string;email:string;name:string;password_hash:string|null;wedding_id:string;slug:string;partner_one:string;partner_two:string;status:string};

async function claimRow(token:string){
 await ensureOrganiserSchema();
 return (await d1Query<ClaimRow>(`SELECT wo.user_id,u.email,u.name,u.password_hash,wo.wedding_id,w.slug,w.partner_one,w.partner_two,wo.status
  FROM wedding_organisers wo
  JOIN organiser_users u ON u.id=wo.user_id
  JOIN weddings w ON w.id=wo.wedding_id
  WHERE wo.claim_token=? LIMIT 1`,[token]))[0];
}

export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
 try{
  const{token}=await params;
  const row=await claimRow(token);
  if(!row)return NextResponse.json({ok:false,error:'This organiser invitation is invalid or has already been used.'},{status:404});
  return NextResponse.json({ok:true,organiser:{name:row.name,email:row.email},wedding:{slug:row.slug,partnerOne:row.partner_one,partnerTwo:row.partner_two},status:row.status});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load organiser invitation.'},{status:500})}
}

export async function POST(request:Request,{params}:{params:Promise<{token:string}>}){
 try{
  const{token}=await params;
  const{password}=await request.json();
  const supplied=String(password||'');
  if(supplied.length<8)return NextResponse.json({ok:false,error:'Choose a password with at least 8 characters.'},{status:400});
  const row=await claimRow(token);
  if(!row)return NextResponse.json({ok:false,error:'This organiser invitation is invalid or has already been used.'},{status:404});
  const passwordHash=row.password_hash||hashOrganiserPassword(supplied);
  if(!row.password_hash)await d1Execute('UPDATE organiser_users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[passwordHash,row.user_id]);
  await d1Execute("UPDATE wedding_organisers SET status='active',claim_token=NULL,updated_at=CURRENT_TIMESTAMP WHERE wedding_id=? AND user_id=?",[row.wedding_id,row.user_id]);
  const expiresAt=Date.now()+1000*60*60*24*30;
  (await cookies()).set(ORGANISER_COOKIE,encodeOrganiserSession({email:row.email,userId:row.user_id,expiresAt}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(expiresAt)});
  return NextResponse.json({ok:true,weddingSlug:row.slug});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not claim organiser account.'},{status:500})}
}
