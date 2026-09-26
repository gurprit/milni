import {NextResponse} from 'next/server';
import {d1Execute,d1Query} from '../../../../lib/d1';
import {currentGuestSession} from '../../../../lib/guestSession';

type WeddingRow={id:string};
type ProfileRow={id:string;guest_id:string;name:string;age:number;pronouns:string|null;wedding_side:string|null;connection_to_couple:string|null;bio:string|null;interests:string|null;photo_object_key:string|null;opted_in:number};
type ProfilePhotoRow={profile_id:string;object_key:string;sort_order:number};
const imageUrl=(key:string|null)=>key?`/api/media?key=${encodeURIComponent(key)}`:undefined;
const photoKey=(value:unknown)=>typeof value==='string'&&value.startsWith('/api/media?key=')?decodeURIComponent(value.split('key=')[1]||''):null;
const missingPhotoTable=(error:unknown)=>error instanceof Error&&/no such table/i.test(error.message);
async function ensurePhotoTable(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS singles_profile_photos (
  wedding_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wedding_id,profile_id,object_key)
 )`);
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_singles_profile_photos ON singles_profile_photos(wedding_id,profile_id,sort_order)');
}
async function readProfilePhotos(weddingId:string){
 try{return await d1Query<ProfilePhotoRow>('SELECT profile_id,object_key,sort_order FROM singles_profile_photos WHERE wedding_id=? ORDER BY profile_id,sort_order',[weddingId])}
 catch(error){if(!missingPhotoTable(error))throw error;return[]}
}
function toProfile(row:ProfileRow,photos:ProfilePhotoRow[]){
 const gallery=photos.filter(photo=>photo.profile_id===row.id).map(photo=>imageUrl(photo.object_key)).filter((url):url is string=>Boolean(url));
 const legacy=imageUrl(row.photo_object_key);
 const photoUrls=gallery.length?gallery:legacy?[legacy]:[];
 return{id:row.id,guestId:row.guest_id,name:row.name,age:row.age,pronouns:row.pronouns??undefined,side:row.connection_to_couple??row.wedding_side??'Friends',bio:row.bio??'',interests:row.interests?JSON.parse(row.interests):[],photoUrl:photoUrls[0],photoUrls,optedIn:Boolean(row.opted_in)};
}
async function weddingId(slug:string){return (await d1Query<WeddingRow>('SELECT id FROM weddings WHERE slug=? LIMIT 1',[slug]))[0]?.id}
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const [rows,photos]=await Promise.all([
   d1Query<ProfileRow>('SELECT id,guest_id,name,age,pronouns,wedding_side,connection_to_couple,bio,interests,photo_object_key,opted_in FROM singles_profiles WHERE wedding_id=? AND opted_in=1 ORDER BY created_at',[id]),
   readProfilePhotos(id)
  ]);
  return NextResponse.json({ok:true,profiles:rows.map(row=>toProfile(row,photos))});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Singles load failed'},{status:500})}
}
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{
  const{slug}=await params;const id=await weddingId(slug);
  if(!id)return NextResponse.json({ok:false,error:'Wedding not found'},{status:404});
  const session=await currentGuestSession();
  if(!session||session.weddingId!==id||session.weddingSlug!==slug)return NextResponse.json({ok:false,error:'Join this wedding as a guest before editing Singles.'},{status:401});
  const profile=await request.json();
  if(!profile.name?.trim()||Number(profile.age)<18)return NextResponse.json({ok:false,error:'Complete your profile first.'},{status:400});
  const guestId=session.guestId;const profileId=`single-${guestId}`;
  const supplied=Array.isArray(profile.photoUrls)?profile.photoUrls.slice(0,6):profile.photoUrl?[profile.photoUrl]:[];
  const photoKeys=[...new Set(supplied.map(photoKey).filter((key):key is string=>Boolean(key)))].slice(0,6);
  const primaryPhotoKey=photoKeys[0]??null;
  await d1Execute(`INSERT INTO singles_profiles(id,wedding_id,guest_id,name,age,pronouns,wedding_side,connection_to_couple,bio,interests,photo_object_key,opted_in,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(wedding_id,guest_id) DO UPDATE SET name=excluded.name,age=excluded.age,pronouns=excluded.pronouns,wedding_side=excluded.wedding_side,connection_to_couple=excluded.connection_to_couple,bio=excluded.bio,interests=excluded.interests,photo_object_key=excluded.photo_object_key,opted_in=excluded.opted_in,updated_at=CURRENT_TIMESTAMP`,[profileId,id,guestId,session.guestName,Number(profile.age),profile.pronouns||null,profile.side||null,profile.side||null,profile.bio||'',JSON.stringify(profile.interests??[]),primaryPhotoKey,profile.optedIn?1:0]);
  const writePhotos=async()=>{
   await d1Execute('DELETE FROM singles_profile_photos WHERE wedding_id=? AND profile_id=?',[id,profileId]);
   for(let index=0;index<photoKeys.length;index++)await d1Execute('INSERT INTO singles_profile_photos(wedding_id,profile_id,object_key,sort_order) VALUES(?,?,?,?)',[id,profileId,photoKeys[index],index]);
  };
  try{await writePhotos()}catch(error){if(!missingPhotoTable(error))throw error;await ensurePhotoTable();await writePhotos()}
  return NextResponse.json({ok:true,photoUrl:imageUrl(primaryPhotoKey),photoUrls:photoKeys.map(key=>imageUrl(key)).filter(Boolean)});
 }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Singles save failed'},{status:500})}
}
