import {NextRequest,NextResponse} from 'next/server';
import {putObject,safeObjectKey} from '../../../../lib/r2';
import {currentOrganiserSession} from '../../../../lib/organiserSession';
import {currentGuestSession} from '../../../../lib/guestSession';
import {organiserCanAccessWedding} from '../../../../lib/organiserAccounts';

export const runtime='nodejs';
const MAX_BYTES=12*1024*1024;

export async function POST(request:NextRequest){
 try{
  const form=await request.formData();
  const file=form.get('file');
  const wedding=String(form.get('wedding')||'').trim();
  const area=String(form.get('area')||'gallery');
  const album=String(form.get('album')||'general');
  if(!wedding)return NextResponse.json({error:'Wedding is required.'},{status:400});

  const organiserSession=await currentOrganiserSession();
  const guestSession=await currentGuestSession();
  const organiser=await organiserCanAccessWedding(organiserSession,wedding);
  const guest=Boolean(guestSession&&guestSession.weddingSlug===wedding);
  if(!organiser&&!guest)return NextResponse.json({error:'Join this wedding before uploading media.'},{status:401});

  if(!(file instanceof File)||!file.type.startsWith('image/'))return NextResponse.json({error:'Please choose an image.'},{status:400});
  if(file.size>MAX_BYTES)return NextResponse.json({error:'Image is larger than 12 MB.'},{status:413});

  const extension=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
  const key=safeObjectKey(`weddings/${wedding}/${area}/${album}/${Date.now()}-${crypto.randomUUID()}.${extension}`);
  await putObject(key,Buffer.from(await file.arrayBuffer()),file.type);
  return NextResponse.json({key,url:`/api/media?key=${encodeURIComponent(key)}`});
 }catch(error){
  console.error(error);
  return NextResponse.json({error:error instanceof Error?error.message:'Upload failed.'},{status:500});
 }
}
