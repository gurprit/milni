import {NextRequest,NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../../lib/d1';
import {currentOrganiserSession} from '../../../../../lib/organiserSession';
import {findOrganiserByEmail,organiserCanAccessWedding} from '../../../../../lib/organiserAccounts';
import {currentGuestSession} from '../../../../../lib/guestSession';

type PhotoRow={id:string;album_id:string|null;event_id:string|null;object_key:string;caption:string|null;uploaded_by_name:string|null;created_at:string};
async function weddingId(slug:string){const rows=await d1Query<{id:string}>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]);return rows[0]?.id}

export async function GET(_request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{const{slug}=await params;const id=await weddingId(slug);if(!id)return NextResponse.json({ok:true,photos:[]});const rows=await d1Query<PhotoRow>('SELECT id,album_id,event_id,object_key,caption,uploaded_by_name,created_at FROM photos WHERE wedding_id=? ORDER BY created_at DESC',[id]);return NextResponse.json({ok:true,photos:rows.map(row=>({id:row.id,albumId:row.album_id??'',eventId:row.event_id??undefined,url:`/api/media?key=${encodeURIComponent(row.object_key)}`,caption:row.caption??'',uploadedBy:row.uploaded_by_name??'Wedding guest',createdAt:row.created_at}))})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load photos'},{status:500})}
}

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const session=await currentGuestSession();
  const organiserSession=await currentOrganiserSession();
  const organiser=await organiserCanAccessWedding(organiserSession,slug);
  const wid=await weddingId(slug);
  if(!wid||(!organiser&&(!session||session.weddingId!==wid||session.weddingSlug!==slug)))return NextResponse.json({ok:false,error:'Join this wedding before adding photos.'},{status:401});
  const body=await request.json() as {id:string;albumId?:string;eventId?:string;objectKey:string;caption?:string;uploadedBy?:string};
  const id=wid;
  let albumId:string|null=null;
  let eventId:string|null=null;

  if(body.albumId){
   const album=(await d1Query<{id:string;event_id:string|null}>('SELECT id,event_id FROM photo_albums WHERE id=? AND wedding_id=? LIMIT 1',[body.albumId,id]))[0];
   if(album){albumId=album.id;eventId=album.event_id??null}
  }

  if(!eventId&&body.eventId){
   const event=(await d1Query<{id:string;name:string}>('SELECT id,name FROM events WHERE id=? AND wedding_id=? LIMIT 1',[body.eventId,id]))[0];
   if(event){
    eventId=event.id;
    const generatedAlbumId=`album-${event.id}`;
    if(body.albumId===generatedAlbumId){
     await d1Execute(`INSERT INTO photo_albums (id,wedding_id,event_id,name,description,updated_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id,name=excluded.name,description=excluded.description,updated_at=CURRENT_TIMESTAMP`,[generatedAlbumId,id,event.id,event.name,`Photos from ${event.name}`]);
     albumId=generatedAlbumId;
    }
   }
  }

  let uploadedBy='Wedding guest';
  if(organiser&&organiserSession?.userId){
   try{uploadedBy=(await findOrganiserByEmail(organiserSession.email))?.name||uploadedBy}catch{}
  }else if(session?.guestName)uploadedBy=session.guestName;
  else if(organiserSession?.email)uploadedBy=body.uploadedBy||organiserSession.email.split('@')[0]||uploadedBy;

  await d1Execute('INSERT INTO photos (id,wedding_id,album_id,event_id,object_key,caption,uploaded_by_name) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET album_id=excluded.album_id,event_id=excluded.event_id,caption=excluded.caption,uploaded_by_name=excluded.uploaded_by_name',[body.id,id,albumId,eventId,body.objectKey,body.caption??'',uploadedBy]);
  return NextResponse.json({ok:true,uploadedBy});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not save photo'},{status:500})}
}

export async function DELETE(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{const{slug}=await params;const organiser=await currentOrganiserSession();if(!await organiserCanAccessWedding(organiser,slug))return NextResponse.json({ok:false,error:'Organiser access required.'},{status:403});const{id}=await request.json() as {id:string};const wid=await weddingId(slug);if(wid)await d1Execute('DELETE FROM photos WHERE id=? AND wedding_id=?',[id,wid]);return NextResponse.json({ok:true})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not remove photo'},{status:500})}
}
