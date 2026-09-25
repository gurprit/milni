import { NextResponse } from 'next/server';
import { d1Execute, d1Query } from '../../../../lib/d1';
import { currentOrganiserSession } from '../../../../lib/organiserSession';
import { organiserCanAccessWedding } from '../../../../lib/organiserAccounts';
import { publishWeddingNotification } from '../../../../lib/notifications';

type WeddingRow={id:string};
type UpdateRow={id:string;title:string;message:string;kind:string;gif_url:string|null;created_at:string};

async function weddingId(slug:string){
 const rows=await d1Query<WeddingRow>('SELECT id FROM weddings WHERE slug = ? LIMIT 1',[slug]);
 return rows[0]?.id||null;
}
async function ensureTable(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS live_updates (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'update',
  gif_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 try{await d1Execute('ALTER TABLE live_updates ADD COLUMN gif_url TEXT')}catch{}
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_live_updates_wedding_created ON live_updates(wedding_id, created_at DESC)');
}

export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params; await ensureTable(); const id=await weddingId(slug);
  if(!id)return NextResponse.json({error:'Wedding not found'},{status:404});
  const updates=await d1Query<UpdateRow>('SELECT id,title,message,kind,gif_url,created_at FROM live_updates WHERE wedding_id = ? ORDER BY created_at DESC LIMIT 100',[id]);
  return NextResponse.json({ok:true,updates});
 }catch(error){console.error('Live updates GET failed',error);return NextResponse.json({error:'Could not load live updates'},{status:500})}
}

export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params; const organiser=await currentOrganiserSession(); if(!await organiserCanAccessWedding(organiser,slug))return NextResponse.json({error:'Organiser access required'},{status:403}); const body=await request.json() as {title?:string;message?:string;kind?:string;gifUrl?:string};
  const title=String(body.title||'').trim().slice(0,80); const message=String(body.message||'').trim().slice(0,1000); const gifUrl=safeGifUrl(body.gifUrl);
  const kind=body.kind==='urgent'?'urgent':'update';
  if(!title||(!message&&!gifUrl))return NextResponse.json({error:'Add a title and a message or GIF'},{status:400});
  await ensureTable(); const id=await weddingId(slug); if(!id)return NextResponse.json({error:'Wedding not found'},{status:404});
  const updateId=crypto.randomUUID(); const createdAt=new Date().toISOString();
  await d1Execute('INSERT INTO live_updates (id,wedding_id,title,message,kind,gif_url,created_at) VALUES (?,?,?,?,?,?,?)',[updateId,id,title,message,kind,gifUrl,createdAt]);
  try{await publishWeddingNotification({weddingId:id,type:'live',title,message:message||'Shared a GIF.',url:`/wedding/${encodeURIComponent(slug)}/live`,priority:kind==='urgent'?'urgent':'normal',sourceId:updateId})}catch(notificationError){console.error('Live update notification failed',notificationError)}
  return NextResponse.json({ok:true,update:{id:updateId,title,message,kind,gif_url:gifUrl,created_at:createdAt}});
 }catch(error){console.error('Live updates POST failed',error);return NextResponse.json({error:'Could not post update'},{status:500})}
}

export async function DELETE(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const {slug}=await params; const organiser=await currentOrganiserSession(); if(!await organiserCanAccessWedding(organiser,slug))return NextResponse.json({error:'Organiser access required'},{status:403}); const body=await request.json() as {id?:string}; if(!body.id)return NextResponse.json({error:'Update id required'},{status:400});
  await ensureTable(); const id=await weddingId(slug); if(!id)return NextResponse.json({error:'Wedding not found'},{status:404});
  await d1Execute('DELETE FROM live_updates WHERE id = ? AND wedding_id = ?',[body.id,id]);
  return NextResponse.json({ok:true});
 }catch(error){console.error('Live updates DELETE failed',error);return NextResponse.json({error:'Could not remove update'},{status:500})}
}

function safeGifUrl(value:unknown){const raw=String(value||'').trim();if(!raw)return null;try{const url=new URL(raw);return url.protocol==='https:'&&(url.hostname==='giphy.com'||url.hostname.endsWith('.giphy.com'))?url.toString():null}catch{return null}}
