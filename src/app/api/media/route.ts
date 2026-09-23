import {NextRequest,NextResponse} from 'next/server';
import {deleteObject,getObject} from '../../../lib/r2';
import {currentOrganiserSession} from '../../../lib/organiserSession';
import {organiserCanAccessWedding} from '../../../lib/organiserAccounts';

export const runtime='nodejs';

export async function GET(request:NextRequest){
 const key=request.nextUrl.searchParams.get('key');
 if(!key)return NextResponse.json({error:'Missing media key'},{status:400});
 try{
  const object=await getObject(key);
  if(!object.ok)return new NextResponse(null,{status:object.status});
  const headers=new Headers();
  headers.set('Content-Type',object.headers.get('content-type')||'image/jpeg');
  headers.set('Cache-Control','private, max-age=3600');
  const length=object.headers.get('content-length');
  if(length)headers.set('Content-Length',length);
  return new NextResponse(object.body,{status:200,headers});
 }catch(error){
  console.error(error);
  return NextResponse.json({error:'Unable to load media'},{status:500});
 }
}

export async function DELETE(request:NextRequest){
 try{
  const {key}=await request.json();
  if(!key)return NextResponse.json({error:'Missing media key'},{status:400});
  const match=String(key).match(/^weddings\/([^/]+)\//);
  if(!match)return NextResponse.json({error:'Invalid wedding media key.'},{status:400});
  const organiser=await currentOrganiserSession();
  if(!await organiserCanAccessWedding(organiser,match[1]))return NextResponse.json({error:'Organiser access required.'},{status:403});
  await deleteObject(String(key));
  return NextResponse.json({ok:true});
 }catch(error){
  console.error(error);
  return NextResponse.json({error:'Unable to delete media'},{status:500});
 }
}
