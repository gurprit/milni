import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {currentOrganiserSession,encodeOrganiserSession,ORGANISER_COOKIE} from '../../../../../../lib/organiserSession';
import {d1Execute,d1Query} from '../../../../../../lib/d1';
import {ensureOrganiserSchema,findOrganiserByEmail,hashOrganiserPassword,newClaimToken,newOrganiserId,organiserCanAccessWedding,verifyOrganiserPassword} from '../../../../../../lib/organiserAccounts';

type Wedding={id:string;partner_one:string;partner_two:string};
type User={id:string;email:string;name:string;password_hash:string|null};

function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const session=await currentOrganiserSession();
  if(!session)return NextResponse.json({ok:false,error:'Organiser sign-in required.'},{status:401});
  if(session.userId&&!await organiserCanAccessWedding(session,slug))return NextResponse.json({ok:false,error:'Organiser access required for this wedding.'},{status:403});

  await ensureOrganiserSchema();
  const wedding=(await d1Query<Wedding>('SELECT id,partner_one,partner_two FROM weddings WHERE slug=? LIMIT 1',[slug]))[0];
  if(!wedding)return NextResponse.json({ok:false,error:'Wedding not found.'},{status:404});
  const existing=(await d1Query<{total:number}>('SELECT COUNT(*) AS total FROM wedding_organisers WHERE wedding_id=?',[wedding.id]))[0];
  if(Number(existing?.total||0)>0)return NextResponse.json({ok:false,error:'Organiser accounts are already set up for this wedding.'},{status:409});

  const body=await request.json();
  const creatorRole=body.creatorRole==='partner-one'?'partner-one':'partner-two';
  const creatorName=creatorRole==='partner-one'?wedding.partner_one:wedding.partner_two;
  const partnerName=creatorRole==='partner-one'?wedding.partner_two:wedding.partner_one;
  const partnerRole=creatorRole==='partner-one'?'partner-two':'partner-one';
  const creatorEmail=String(body.creatorEmail||'').trim().toLowerCase();
  const partnerEmail=String(body.partnerEmail||'').trim().toLowerCase();
  const creatorPassword=String(body.creatorPassword||'');

  if(!validEmail(creatorEmail)||!validEmail(partnerEmail))return NextResponse.json({ok:false,error:'Add a valid email address for both partners.'},{status:400});
  if(creatorEmail===partnerEmail)return NextResponse.json({ok:false,error:'Each organiser needs their own email address.'},{status:400});
  if(creatorPassword.length<8)return NextResponse.json({ok:false,error:'Choose a password with at least 8 characters.'},{status:400});

  let creator=await findOrganiserByEmail(creatorEmail) as User|undefined;
  if(creator?.password_hash&&!verifyOrganiserPassword(creatorPassword,creator.password_hash))return NextResponse.json({ok:false,error:'That email already has an organiser account. Enter its existing password.'},{status:401});
  if(!creator){
   creator={id:newOrganiserId(),email:creatorEmail,name:creatorName,password_hash:hashOrganiserPassword(creatorPassword)};
   await d1Execute('INSERT INTO organiser_users (id,email,name,password_hash,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)',[creator.id,creator.email,creator.name,creator.password_hash]);
  }else if(!creator.password_hash){
   creator.password_hash=hashOrganiserPassword(creatorPassword);
   await d1Execute('UPDATE organiser_users SET name=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[creatorName,creator.password_hash,creator.id]);
  }else{
   await d1Execute('UPDATE organiser_users SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[creatorName,creator.id]);
  }

  let partner=await findOrganiserByEmail(partnerEmail) as User|undefined;
  if(!partner){
   partner={id:newOrganiserId(),email:partnerEmail,name:partnerName,password_hash:null};
   await d1Execute('INSERT INTO organiser_users (id,email,name,password_hash,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)',[partner.id,partner.email,partner.name,null]);
  }else{
   await d1Execute('UPDATE organiser_users SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[partnerName,partner.id]);
  }

  await d1Execute('INSERT INTO wedding_organisers (wedding_id,user_id,role,status,claim_token,updated_at) VALUES (?,?,?,?,NULL,CURRENT_TIMESTAMP)',[wedding.id,creator.id,creatorRole,'active']);
  const partnerActive=Boolean(partner.password_hash);
  const claimToken=partnerActive?null:newClaimToken();
  await d1Execute('INSERT INTO wedding_organisers (wedding_id,user_id,role,status,claim_token,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)',[wedding.id,partner.id,partnerRole,partnerActive?'active':'pending',claimToken]);

  const expiresAt=Date.now()+1000*60*60*24*30;
  (await cookies()).set(ORGANISER_COOKIE,encodeOrganiserSession({email:creator.email,userId:creator.id,expiresAt}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(expiresAt)});

  const origin=new URL(request.url).origin;
  return NextResponse.json({ok:true,partnerClaimUrl:claimToken?`${origin}/organiser/claim/${encodeURIComponent(claimToken)}`:null});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not set up organiser accounts.'},{status:500});
 }
}
