import {NextResponse} from 'next/server';
import {currentOrganiserSession} from '../../../../../lib/organiserSession';
import {d1Query} from '../../../../../lib/d1';
import {ensureOrganiserSchema,organiserCanAccessWedding} from '../../../../../lib/organiserAccounts';

type Row={name:string;email:string;role:string;status:string;claim_token:string|null};

export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const session=await currentOrganiserSession();
  if(!await organiserCanAccessWedding(session,slug))return NextResponse.json({ok:false,error:'Organiser access required.'},{status:403});
  await ensureOrganiserSchema();
  const wedding=(await d1Query<{id:string}>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0];
  if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found.'},{status:404});
  const rows=await d1Query<Row>(`SELECT u.name,u.email,wo.role,wo.status,wo.claim_token
    FROM wedding_organisers wo
    JOIN organiser_users u ON u.id=wo.user_id
    WHERE wo.wedding_id=?
    ORDER BY CASE wo.role WHEN 'partner-one' THEN 1 WHEN 'partner-two' THEN 2 ELSE 3 END,u.name`,[wedding.id]);
  const origin=new URL(request.url).origin;
  return NextResponse.json({ok:true,organisers:rows.map(row=>({
   name:row.name,email:row.email,role:row.role,status:row.status,
   claimUrl:row.claim_token?`${origin}/organiser/claim/${encodeURIComponent(row.claim_token)}`:null
  }))});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load organisers.'},{status:500})}
}
