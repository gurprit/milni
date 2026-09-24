import {NextRequest,NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../../lib/d1';
import {currentOrganiserSession} from '../../../../../lib/organiserSession';
import {findOrganiserByEmail,organiserCanAccessWedding} from '../../../../../lib/organiserAccounts';
import {currentGuestSession} from '../../../../../lib/guestSession';

type PhotoRow={id:string;album_id:string|null;event_id:string|null;object_key:string;caption:string|null;uploaded_by_name:string|null;created_at:string;like_count?:number;liked_by_me?:number};
async function ensureLikes(){await d1Execute(`CREATE TABLE IF NOT EXISTS photo_likes (photo_id TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(photo_id,actor_id),FOREIGN KEY(photo_id) REFERENCES photos(id) ON DELETE CASCADE)`)}
async function actorId(slug:string,wid:string){const guest=await currentGuestSession();if(guest&&guest.weddingId===wid&&guest.weddingSlug===slug)return `guest:${guest.guestId}`;const organiser=await currentOrganiserSession();if(await organiserCanAccessWedding(organiser,slug))return `organiser:${organiser?.userId||organiser?.email||'organiser'}`;return ''}
async function weddingId(slug:string){const rows=await d1Query<{id:string}>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]);return rows[0]?.id}

export async function GET(_request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{const{slug}=await params;const id=await weddingId(slug);if(!id)return NextResponse.json({ok:true,photos:[]});await ensureLikes();const actor=await actorId(slug,id);const rows=await d1Query<PhotoRow>(`SELECT p.id,p.album_id,p.event_id,p.object_key,p.caption,p.uploaded_by_name,p.created_at,(SELECT COUNT(*) FROM photo_likes l WHERE l.photo_id=p.id) like_count,(SELECT COUNT(*) FROM photo_likes l WHERE l.photo_id=p.id AND l.actor_id=?) liked_by_me FROM photos p WHERE p.wedding_id=? ORDER BY p.created_at DESC`,[actor,id]);return NextResponse.json({ok:true,photos:rows.map(row=>({id:row.id,albumId:row.album_id??'',eventId:row.event_id??undefined,url:`/api/media?key=${encodeURIComponent(row.object_key)}`,caption:row.caption??'',uploadedBy:row.uploaded_by_name??'Wedding guest',createdAt:row.created_at,likeCount:Number(row.like_count||0),likedByMe:Boolean(row.liked_by_me)}))})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Could not load photos'},{status:500})}
}

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;
  const session=await currentGuestSession();
  const organiserSession=await currentOrganiserSession();
  const organiser=await organiserCanAccessWedding(organiserSession,slug);
  const wid=await weddingId(slug);
  if(!wid||(!organiser&&(!session||session.weddingId!==wid||session.weddingSlug!==slug)))return NextResponse.json({ok:false,error:'Join this wedding before adding photos.'},{status:401});
  const body=await request.json() as {action?:string;photoId?:string;id:string;albumId?:string;eventId?:string;objectKey:string;caption?:string;uploadedBy?:string};
  if(body.action==='like'){await ensureLikes();const actor=await actorId(slug,wid);if(!actor)return NextResponse.json({ok:false,error:'Join this wedding before liking photos.'},{status:401});if(!body.photoId)return NextResponse.json({ok:false,error:'Photo required.'},{status:400});const photo=(await d1Query<{id:string}>('SELECT id FROM photos WHERE id=? AND wedding_id=? LIMIT 1',[body.photoId,wid]))[0];if(!photo)return NextResponse.json({ok:false,error:'Photo not found.'},{status:404});const existing=await d1Query<{actor_id:string}>('SELECT actor_id FROM photo_likes WHERE photo_id=? AND actor_id=?',[body.photoId,actor]);if(existing.length)await d1Execute('DELETE FROM photo_likes WHERE photo_id=? AND actor_id=?',[body.photoId,actor]);else await d1Execute('INSERT INTO photo_likes(photo_id,actor_id,created_at) VALUES(?,?,?)',[body.photoId,actor,new Date().toISOString()]);const count=(await d1Query<{count:number}>('SELECT COUNT(*) count FROM photo_likes WHERE photo_id=?',[body.photoId]))[0]?.count||0;return NextResponse.json({ok:true,liked:!existing.length,likeCount:Number(count)})}
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
