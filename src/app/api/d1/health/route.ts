import {NextResponse} from 'next/server';
import {d1Query} from '../../../../lib/d1';

export const runtime='nodejs';

export async function GET(){
 try{
  const rows=await d1Query<{name:string}>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return NextResponse.json({ok:true,tables:rows.map(row=>row.name),tableCount:rows.length});
 }catch(error){
  console.error('D1 health check failed',error);
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:'D1 connection failed'},{status:500});
 }
}
