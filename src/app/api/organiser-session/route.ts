import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {currentOrganiserSession,encodeOrganiserSession,ORGANISER_COOKIE} from '../../../lib/organiserSession';
import {findOrganiserByEmail,organiserCanAccessWedding,verifyOrganiserPassword} from '../../../lib/organiserAccounts';

const safeEqual=(a:string,b:string)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};

export async function GET(request:Request){
 const session=await currentOrganiserSession();
 if(!session)return NextResponse.json({ok:true,organiser:null});
 let slug=new URL(request.url).searchParams.get('slug');
 if(!slug){
  const referer=request.headers.get('referer');
  if(referer){
   try{const match=new URL(referer).pathname.match(/^\/wedding\/([^/]+)/);if(match)slug=decodeURIComponent(match[1])}catch{}
  }
 }
 if(slug&&session.userId&&!await organiserCanAccessWedding(session,slug))return NextResponse.json({ok:true,organiser:null});
 return NextResponse.json({ok:true,organiser:{email:session.email,userId:session.userId??null}});
}

export async function POST(request:Request){
 const{email,password,slug}=await request.json();
 const normalisedEmail=String(email||'').trim().toLowerCase();
 const suppliedPassword=String(password||'');

 try{
  const account=await findOrganiserByEmail(normalisedEmail);
  if(account?.password_hash&&await verifyOrganiserPassword(suppliedPassword,account.password_hash)){
   const requestedSlug=String(slug||'').trim();
   if(requestedSlug&&!await organiserCanAccessWedding({userId:account.id},requestedSlug))return NextResponse.json({ok:false,error:'This organiser account does not have access to that wedding.'},{status:403});
   const expiresAt=Date.now()+1000*60*60*24*30;
   (await cookies()).set(ORGANISER_COOKIE,encodeOrganiserSession({email:account.email,userId:account.id,expiresAt}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(expiresAt)});
   return NextResponse.json({ok:true,organiser:{email:account.email,userId:account.id}});
  }
 }catch(error){
  console.error('Organiser account login lookup failed',error);
 }

 // Keep the original environment login available while existing prototype weddings are migrated.
 const expectedEmail=process.env.MILNI_ORGANISER_EMAIL||'';
 const expectedPassword=process.env.MILNI_ORGANISER_PASSWORD||'';
 if(!expectedEmail||!expectedPassword)return NextResponse.json({ok:false,error:'Email or password is incorrect.'},{status:401});
 if(!safeEqual(normalisedEmail,expectedEmail.trim().toLowerCase())||!safeEqual(suppliedPassword,expectedPassword))return NextResponse.json({ok:false,error:'Email or password is incorrect.'},{status:401});
 const expiresAt=Date.now()+1000*60*60*24*14;
 (await cookies()).set(ORGANISER_COOKIE,encodeOrganiserSession({email:expectedEmail,expiresAt}),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires:new Date(expiresAt)});
 return NextResponse.json({ok:true,organiser:{email:expectedEmail,userId:null}});
}

export async function DELETE(){
 (await cookies()).set(ORGANISER_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
 return NextResponse.json({ok:true});
}
