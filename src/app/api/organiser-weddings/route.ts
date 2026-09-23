import {NextResponse} from 'next/server';
import {currentOrganiserSession} from '../../../lib/organiserSession';
import {listOrganiserWeddings} from '../../../lib/organiserAccounts';

export async function GET(){
 try{
  const session=await currentOrganiserSession();
  if(!session?.userId)return NextResponse.json({ok:false,error:'Sign in with an organiser account.'},{status:401});
  const weddings=await listOrganiserWeddings(session.userId);
  return NextResponse.json({ok:true,organiser:{email:session.email},weddings});
 }catch(error){
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load weddings.'},{status:500});
 }
}
