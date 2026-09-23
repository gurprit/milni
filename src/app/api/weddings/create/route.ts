import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {d1Execute,d1Query} from '../../../../lib/d1';
import {encodeOrganiserSession,ORGANISER_COOKIE} from '../../../../lib/organiserSession';
import {ensureOrganiserSchema,findOrganiserByEmail,hashOrganiserPassword,newClaimToken,newOrganiserId,verifyOrganiserPassword} from '../../../../lib/organiserAccounts';
import {WeddingDraft,weddingSlug} from '../../../../lib/weddingDraft';

type WeddingRow={id:string;slug:string};
type UserRow={id:string;email:string;name:string;password_hash:string|null};

function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

export async function POST(request:Request){
 try{
  const body=await request.json();
  const draft=body.draft as WeddingDraft;
  const creatorEmail=String(body.creatorEmail||'').trim().toLowerCase();
  const partnerEmail=String(body.partnerEmail||'').trim().toLowerCase();
  const creatorPassword=String(body.creatorPassword||'');

  if(!draft?.partnerOne?.trim()||!draft?.partnerTwo?.trim())return NextResponse.json({ok:false,error:'Add both partner names.'},{status:400});
  if(!validEmail(creatorEmail)||!validEmail(partnerEmail))return NextResponse.json({ok:false,error:'Add a valid email address for both partners.'},{status:400});
  if(creatorEmail===partnerEmail)return NextResponse.json({ok:false,error:'Each organiser needs their own email address.'},{status:400});
  if(creatorPassword.length<8)return NextResponse.json({ok:false,error:'Choose a password with at least 8 characters.'},{status:400});

  await ensureOrganiserSchema();
  const slug=weddingSlug(draft);
  const existingWedding=(await d1Query<WeddingRow>('SELECT id,slug FROM weddings WHERE slug=? LIMIT 1',[slug]))[0];
  if(existingWedding)return NextResponse.json({ok:false,error:'A wedding with these names already exists. Sign in to continue organising it.'},{status:409});

  let creator=await findOrganiserByEmail(creatorEmail) as UserRow|undefined;
  if(creator?.password_hash&&!await verifyOrganiserPassword(creatorPassword,creator.password_hash))return NextResponse.json({ok:false,error:'That organiser email already has an account. Use the existing password or sign in first.'},{status:401});
  if(!creator){
   creator={id:newOrganiserId(),email:creatorEmail,name:draft.partnerOne.trim(),password_hash:await hashOrganiserPassword(creatorPassword)};
   await d1Execute('INSERT INTO organiser_users (id,email,name,password_hash,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)',[creator.id,creator.email,creator.name,creator.password_hash]);
  }else if(!creator.password_hash){
   creator.password_hash=await hashOrganiserPassword(creatorPassword);
   await d1Execute('UPDATE organiser_users SET name=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[draft.partnerOne.trim(),creator.password_hash,creator.id]);
  }else{
   await d1Execute('UPDATE organiser_users SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[draft.partnerOne.trim(),creator.id]);
  }

  let partner=await findOrganiserByEmail(partnerEmail) as UserRow|undefined;
  if(!partner){
   partner={id:newOrganiserId(),email:partnerEmail,name:draft.partnerTwo.trim(),password_hash:null};
   await d1Execute('INSERT INTO organiser_users (id,email,name,password_hash,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)',[partner.id,partner.email,partner.name,null]);
  }else{
   await d1Execute('UPDATE organiser_users SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[draft.partnerTwo.trim(),partner.id]);
  }

  const weddingId=`wedding-${slug}`;
  await d1Execute(`INSERT INTO weddings (id,slug,partner_one,partner_two,title,city,start_date,end_date,updated_at)
    VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,[weddingId,slug,draft.partnerOne.trim(),draft.partnerTwo.trim(),draft.title||'',draft.city||'',draft.startDate||'',draft.endDate||'']);

  await d1Execute(`INSERT INTO wedding_organisers (wedding_id,user_id,role,status,claim_token,updated_at)
    VALUES (?,?,?,?,NULL,CURRENT_TIMESTAMP)
    ON CONFLICT(wedding_id,user_id) DO UPDATE SET role=excluded.role,status='active',claim_token=NULL,updated_at=CURRENT_TIMESTAMP`,[weddingId,creator.id,'partner-one','active']);

  const partnerAlreadyActive=Boolean(partner.password_hash);
  const claimToken=partnerAlreadyActive?null:newClaimToken();
  await d1Execute(`INSERT INTO wedding_organisers (wedding_id,user_id,role,status,claim_token,updated_at)
    VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(wedding_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status,claim_token=excluded.claim_token,updated_at=CURRENT_TIMESTAMP`,[weddingId,partner.id,'partner-two',partnerAlreadyActive?'active':'pending',claimToken]);

  const expiresAt=Date.now()+1000*60*60*24*30;
  (await cookies()).set(ORGANISER_COOKIE,encodeOrganiserSession({email:creator.email,userId:creator.id,expiresAt}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(expiresAt)});

  const origin=new URL(request.url).origin;
  return NextResponse.json({
   ok:true,
   slug,
   organiser:{email:creator.email,name:creator.name},
   partner:{email:partner.email,name:partner.name,status:partnerAlreadyActive?'active':'pending'},
   partnerClaimUrl:claimToken?`${origin}/organiser/claim/${encodeURIComponent(claimToken)}`:null
  });
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not create wedding accounts.'},{status:500});
 }
}
