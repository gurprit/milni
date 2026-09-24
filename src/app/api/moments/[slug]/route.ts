import {NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../lib/d1';
import {currentGuestSession} from '../../../../lib/guestSession';
import {currentOrganiserSession} from '../../../../lib/organiserSession';
import {organiserCanAccessWedding} from '../../../../lib/organiserAccounts';
import {publishWeddingNotification} from '../../../../lib/notifications';

type WeddingRow={id:string};
type PostRow={id:string;author_id:string;author_name:string;author_role:string;message:string;media_url:string|null;event_id:string|null;event_name:string|null;created_at:string;like_count:number;comment_count:number;liked_by_me:number};
type CommentRow={id:string;post_id:string;author_id:string;author_name:string;author_role:string;message:string;media_url:string|null;created_at:string};

async function weddingId(slug:string){const rows=await d1Query<WeddingRow>('SELECT id FROM weddings WHERE slug = ? LIMIT 1',[slug]);return rows[0]?.id||null}
async function ensureTables(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS moments_posts (
  id TEXT PRIMARY KEY,wedding_id TEXT NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,author_role TEXT NOT NULL DEFAULT 'guest',
  message TEXT NOT NULL DEFAULT '',media_url TEXT,event_id TEXT,event_name TEXT,created_at TEXT NOT NULL,
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE)`);
 await d1Execute(`CREATE TABLE IF NOT EXISTS moments_likes (
  post_id TEXT NOT NULL,actor_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(post_id,actor_id),
  FOREIGN KEY (post_id) REFERENCES moments_posts(id) ON DELETE CASCADE)`);
 await d1Execute(`CREATE TABLE IF NOT EXISTS moments_comments (
  id TEXT PRIMARY KEY,post_id TEXT NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,author_role TEXT NOT NULL DEFAULT 'guest',
  message TEXT NOT NULL DEFAULT '',media_url TEXT,created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES moments_posts(id) ON DELETE CASCADE)`);
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_moments_posts_wedding_created ON moments_posts(wedding_id,created_at DESC)');
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_moments_comments_post_created ON moments_comments(post_id,created_at ASC)');
}
async function actor(slug:string){
 const guest=await currentGuestSession();
 if(guest&&guest.weddingSlug===slug)return{id:`guest:${guest.guestId}`,name:guest.guestName||'Wedding guest',role:'guest' as const};
 const organiser=await currentOrganiserSession();
 if(await organiserCanAccessWedding(organiser,slug))return{id:`organiser:${organiser?.userId||organiser?.email||'organiser'}`,name:organiser?.email?.split('@')[0]||'Organiser',role:'organiser' as const};
 return null;
}
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{const{slug}=await params;await ensureTables();const id=await weddingId(slug);if(!id)return NextResponse.json({error:'Wedding not found'},{status:404});
 const me=await actor(slug);const posts=await d1Query<PostRow>(`SELECT p.*,
  (SELECT COUNT(*) FROM moments_likes l WHERE l.post_id=p.id) like_count,
  (SELECT COUNT(*) FROM moments_comments c WHERE c.post_id=p.id) comment_count,
  (SELECT COUNT(*) FROM moments_likes l WHERE l.post_id=p.id AND l.actor_id=?) liked_by_me
  FROM moments_posts p WHERE p.wedding_id=? ORDER BY p.created_at DESC LIMIT 200`,[me?.id||'',id]);
 const comments=posts.length?await d1Query<CommentRow>(`SELECT c.* FROM moments_comments c JOIN moments_posts p ON p.id=c.post_id WHERE p.wedding_id=? ORDER BY c.created_at ASC`,[id]):[];
 return NextResponse.json({ok:true,posts:posts.map(p=>({...p,liked_by_me:Boolean(p.liked_by_me),comments:comments.filter(c=>c.post_id===p.id)})),canPost:Boolean(me),actor:me});
 }catch(error){console.error('Moments GET failed',error);return NextResponse.json({error:'Could not load moments'},{status:500})}
}
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{const{slug}=await params;const me=await actor(slug);if(!me)return NextResponse.json({error:'Join this wedding before posting.'},{status:401});await ensureTables();const id=await weddingId(slug);if(!id)return NextResponse.json({error:'Wedding not found'},{status:404});
 const body=await request.json() as {action?:string;postId?:string;message?:string;mediaUrl?:string;eventId?:string;eventName?:string};
 if(body.action==='like'){if(!body.postId)return NextResponse.json({error:'Post required'},{status:400});const target=(await d1Query<{author_id:string;author_name:string}>('SELECT author_id,author_name FROM moments_posts WHERE id=? AND wedding_id=?',[body.postId,id]))[0];if(!target)return NextResponse.json({error:'Moment not found'},{status:404});const exists=await d1Query<{actor_id:string}>('SELECT actor_id FROM moments_likes WHERE post_id=? AND actor_id=?',[body.postId,me.id]);if(exists.length)await d1Execute('DELETE FROM moments_likes WHERE post_id=? AND actor_id=?',[body.postId,me.id]);else{await d1Execute('INSERT INTO moments_likes(post_id,actor_id,created_at) VALUES(?,?,?)',[body.postId,me.id,new Date().toISOString()]);const recipient=target.author_id.startsWith('guest:')?target.author_id.slice(6):'';if(recipient&&target.author_id!==me.id)await publishWeddingNotification({weddingId:id,type:'moment_like',title:'Someone loved your Moment ♡',message:`${me.name} liked your post.`,url:`/wedding/${slug}/moments#moment-${body.postId}`,sourceId:`like:${body.postId}:${me.id}`,recipientGuestId:recipient})}return NextResponse.json({ok:true,liked:!exists.length})}
 if(body.action==='comment'){const message=String(body.message||'').trim().slice(0,1000);const mediaUrl=String(body.mediaUrl||'').trim()||null;if(!body.postId||(!message&&!mediaUrl))return NextResponse.json({error:'Add a comment or photo.'},{status:400});const comment={id:crypto.randomUUID(),post_id:body.postId,author_id:me.id,author_name:me.name,author_role:me.role,message,media_url:mediaUrl,created_at:new Date().toISOString()};await d1Execute('INSERT INTO moments_comments(id,post_id,author_id,author_name,author_role,message,media_url,created_at) VALUES(?,?,?,?,?,?,?,?)',[comment.id,comment.post_id,comment.author_id,comment.author_name,comment.author_role,comment.message,comment.media_url,comment.created_at]);const target=(await d1Query<{author_id:string}>('SELECT author_id FROM moments_posts WHERE id=? AND wedding_id=?',[body.postId,id]))[0];const recipient=target?.author_id.startsWith('guest:')?target.author_id.slice(6):'';if(recipient&&target.author_id!==me.id)await publishWeddingNotification({weddingId:id,type:'moment_comment',title:`${me.name} commented on your Moment`,message:message||'Added a photo to your post.',url:`/wedding/${slug}/moments#moment-${body.postId}`,sourceId:comment.id,recipientGuestId:recipient});return NextResponse.json({ok:true,comment})}
 const message=String(body.message||'').trim().slice(0,2000);const mediaUrl=String(body.mediaUrl||'').trim()||null;if(!message&&!mediaUrl)return NextResponse.json({error:'Share a message or photo.'},{status:400});const post={id:crypto.randomUUID(),author_id:me.id,author_name:me.name,author_role:me.role,message,media_url:mediaUrl,event_id:String(body.eventId||'').trim()||null,event_name:String(body.eventName||'').trim()||null,created_at:new Date().toISOString()};
 await d1Execute('INSERT INTO moments_posts(id,wedding_id,author_id,author_name,author_role,message,media_url,event_id,event_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[post.id,id,post.author_id,post.author_name,post.author_role,post.message,post.media_url,post.event_id,post.event_name,post.created_at]);return NextResponse.json({ok:true,post:{...post,like_count:0,comment_count:0,liked_by_me:false,comments:[]}});
 }catch(error){console.error('Moments POST failed',error);return NextResponse.json({error:'Could not save moment'},{status:500})}
}
export async function DELETE(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{const{slug}=await params;const me=await actor(slug);if(!me)return NextResponse.json({error:'Sign in required'},{status:401});await ensureTables();const body=await request.json() as{id?:string;type?:string};if(!body.id)return NextResponse.json({error:'Item required'},{status:400});
 if(body.type==='comment'){const rows=await d1Query<{author_id:string}>('SELECT author_id FROM moments_comments WHERE id=?',[body.id]);if(!rows[0]||(rows[0].author_id!==me.id&&me.role!=='organiser'))return NextResponse.json({error:'Not allowed'},{status:403});await d1Execute('DELETE FROM moments_comments WHERE id=?',[body.id])}
 else{const rows=await d1Query<{author_id:string}>('SELECT author_id FROM moments_posts WHERE id=?',[body.id]);if(!rows[0]||(rows[0].author_id!==me.id&&me.role!=='organiser'))return NextResponse.json({error:'Not allowed'},{status:403});await d1Execute('DELETE FROM moments_posts WHERE id=?',[body.id])}
 return NextResponse.json({ok:true});
 }catch(error){console.error('Moments DELETE failed',error);return NextResponse.json({error:'Could not remove item'},{status:500})}
}