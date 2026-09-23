import crypto from 'node:crypto';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {currentOrganiserSession,encodeOrganiserSession,ORGANISER_COOKIE} from '../../../lib/organiserSession';
import {findOrganiserByEmail,verifyOrganiserPassword} from '../../../lib/organiserAccounts';

const safeEqual=(a:string,b:string)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)};

export async function GET(){
 const session=await currentOrganiserSession();
 return NextResponse.json({ok:true,organiser:session?{email:session.email,userId:session.userId??null}:null});
}

export async function POST(request:Request){
 const{email,password}=await request.json();
 const normalisedEmail=String(email||'').trim().toLowerCase();
 const suppliedPassword=String(password||'');

 try{
  const account=await findOrganiserByEmail(normalisedEmail);
  if(account?.password_hash&&verifyOrganiserPassword(suppliedPassword,account.password_hash)){
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
