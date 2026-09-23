'use client';
import {ChangeEvent,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import WeddingSidebar from './WeddingSidebar';
import {PhotoAlbum,WeddingDraft,WeddingPhoto,emptyDraft,formatDateRange,readSharedWeddingDraft,readWeddingDraft,writeWeddingDraft} from '../../../lib/weddingDraft';
import dashboard from './dashboard.module.scss';
import styles from './photos.module.scss';

const VIEW_MODE_KEY='milni:view-mode';
const LOCAL_PHOTOS_KEY='milni:photo-previews';
const nav=[['home','⌂','Home'],['schedule','▣','Schedule'],['events','✦','Events'],['travel','▤','Travel'],['menu','♨','Menu'],['music','♫','Music'],['photos','▧','Photos'],['guests','♧','Guests'],['singles','♡','Singles'],['live','♢','Live'],['invite','✉','Invitation']] as const;
type PreviewStore=Record<string,string>;

export default function PhotosPage(){
 const[draft,setDraft]=useState<WeddingDraft>(emptyDraft);
 const[organiser,setOrganiser]=useState(false);
 const[organiserAuthed,setOrganiserAuthed]=useState(false);
 const[showOrganiserLogin,setShowOrganiserLogin]=useState(false);
 const[organiserEmail,setOrganiserEmail]=useState('');
 const[organiserPassword,setOrganiserPassword]=useState('');
 const[organiserError,setOrganiserError]=useState('');
 const[modeReady,setModeReady]=useState(false);
 const[activeAlbum,setActiveAlbum]=useState('all');
 const[uploadAlbum,setUploadAlbum]=useState('');
 const[organiserName,setOrganiserName]=useState('');
 const[guestName,setGuestName]=useState('');
 const[caption,setCaption]=useState('');
 const[now,setNow]=useState(()=>Date.now());
 const[previews,setPreviews]=useState<PreviewStore>({});
 const[lightbox,setLightbox]=useState<WeddingPhoto|null>(null);
 const[uploading,setUploading]=useState(false);
 const[uploadError,setUploadError]=useState('');
 const[sharedReady,setSharedReady]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const uploadAlbumTouched=useRef(false);
 const params=useParams();
 const slug=String(params.slug||'our-wedding');

 useEffect(()=>{
  const local=readWeddingDraft();
  try{setPreviews(JSON.parse(localStorage.getItem(LOCAL_PHOTOS_KEY)||'{}'))}catch{}
  void (async()=>{
   try{
    const [organiserResponse,guestResponse,loadedDraft]=await Promise.all([
     fetch(`/api/organiser-session?slug=${encodeURIComponent(slug)}`,{cache:'no-store'}),
     fetch('/api/guest-session',{cache:'no-store'}),
     readSharedWeddingDraft(slug,local)
    ]);
    const organiserResult=await organiserResponse.json().catch(()=>({organiser:null}));
    const guestResult=await guestResponse.json().catch(()=>({guest:null}));
    const authed=!!organiserResult.organiser;
    const organiserMode=authed&&localStorage.getItem(VIEW_MODE_KEY)==='organiser';
    setOrganiserAuthed(authed);
    setOrganiser(organiserMode);
    setOrganiserName(organiserResult.organiser?.name||'');
    setGuestName(guestResult.guest?.name||'');
    setModeReady(true);

    const albums=ensureEventAlbums(loadedDraft);
    const albumsChanged=albums.length!==(loadedDraft.photoAlbums??[]).length;
    const loaded={...loadedDraft,photoAlbums:albums};
    setDraft(loaded);
    writeWeddingDraft({photoAlbums:albums});
    if(albumsChanged&&authed){
     void fetch(`/api/weddings/${encodeURIComponent(slug)}/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(loaded)}).catch(()=>{});
    }

    const response=await fetch(`/api/weddings/${encodeURIComponent(slug)}/photos`,{cache:'no-store'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Could not load shared photos');
    const shared=(result.photos??[]) as WeddingPhoto[];
    const legacy=(local.photos??[]).filter(photo=>photo.url.startsWith('local://'));
    const next=[...shared,...legacy];
    setDraft(current=>({...current,photos:next}));
    writeWeddingDraft({photos:next});
    setSharedReady(true);
   }catch(error){
    setModeReady(true);
    setUploadError(error instanceof Error?error.message:'Could not connect to the shared wedding gallery');
   }
  })();
 },[slug]);

 useEffect(()=>{
  const timer=window.setInterval(()=>setNow(Date.now()),60_000);
  return()=>window.clearInterval(timer);
 },[]);

 const setMode=(next:boolean)=>{if(next&&!organiserAuthed){setShowOrganiserLogin(true);return}setOrganiser(next);localStorage.setItem(VIEW_MODE_KEY,next?'organiser':'guest')};
 const loginOrganiser=async()=>{setOrganiserError('');const response=await fetch('/api/organiser-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:organiserEmail,password:organiserPassword,slug})});const result=await response.json();if(!response.ok){setOrganiserError(result.error||'Could not sign in.');return}setOrganiserAuthed(true);setOrganiserName(result.organiser?.name||'');setShowOrganiserLogin(false);setOrganiserPassword('');setOrganiser(true);localStorage.setItem(VIEW_MODE_KEY,'organiser')};
 const albums=draft.photoAlbums??[];
 const photos=draft.photos??[];
 const events=useMemo(()=>(draft.schedule??[]).flatMap(day=>day.events.map(event=>({id:event.id,label:`${day.label} · ${event.name}`}))),[draft.schedule]);
 const eventIds=useMemo(()=>new Set(events.map(event=>event.id)),[events]);
 const eventAlbums=useMemo(()=>albums.filter(album=>album.eventId&&eventIds.has(album.eventId)),[albums,eventIds]);
 const customAlbums=useMemo(()=>albums.filter(album=>!album.eventId||!eventIds.has(album.eventId)),[albums,eventIds]);
 const suggestedAlbum=useMemo(()=>suggestAlbumForNow(draft,albums,new Date(now)),[draft.schedule,albums,now]);
 const uploaderName=(organiser?organiserName:guestName)||organiserName||guestName||'Wedding guest';
 useEffect(()=>{if(!uploadAlbumTouched.current&&suggestedAlbum&&uploadAlbum!==suggestedAlbum)setUploadAlbum(suggestedAlbum)},[suggestedAlbum,uploadAlbum]);
 const syncDraft=(next:WeddingDraft)=>fetch(`/api/weddings/${encodeURIComponent(slug)}/sync`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)}).catch(()=>{});
 const saveAlbums=(next:PhotoAlbum[])=>{const nextDraft={...draft,photoAlbums:next};setDraft(nextDraft);writeWeddingDraft({photoAlbums:next});void syncDraft(nextDraft)};
 const savePhotos=(next:WeddingPhoto[])=>{setDraft(current=>({...current,photos:next}));writeWeddingDraft({photos:next})};
 const addAlbum=()=>saveAlbums([...albums,{id:`album-custom-${Date.now()}`,name:'New album',description:'Wedding memories'}]);
 const updateAlbum=(id:string,patch:Partial<PhotoAlbum>)=>saveAlbums(albums.map(album=>album.id===id?{...album,...patch}:album));
 const removeAlbum=(id:string)=>{if(!window.confirm('Remove this album? Photos will remain in the wedding gallery.'))return;saveAlbums(albums.filter(album=>album.id!==id));if(activeAlbum===id)setActiveAlbum('all')};
 const chooseFiles=()=>inputRef.current?.click();

 const filesSelected=async(e:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(e.target.files??[]).filter(file=>file.type.startsWith('image/'));
  if(!files.length)return;
  setUploading(true);
  setUploadError('');
  const albumId=uploadAlbum||albums[0]?.id||'general';
  const eventId=albums.find(album=>album.id===albumId)?.eventId;
  const created:WeddingPhoto[]=[];
  try{
   for(const original of files.slice(0,12)){
    const file=await resizeForUpload(original);
    const form=new FormData();
    form.append('file',file,file.name);
    form.append('wedding',slug);
    form.append('area','gallery');
    form.append('album',albumId);
    const response=await fetch('/api/media/upload',{method:'POST',body:form});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Upload failed');
    const photo:WeddingPhoto={id:result.key,albumId,eventId,url:result.url,caption:caption.trim(),uploadedBy:uploaderName,createdAt:new Date().toISOString()};
    const metadata=await fetch(`/api/weddings/${encodeURIComponent(slug)}/photos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:photo.id,albumId:photo.albumId,eventId:photo.eventId,objectKey:result.key,caption:photo.caption,uploadedBy:photo.uploadedBy})});
    if(!metadata.ok){await fetch('/api/media',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:result.key})}).catch(()=>{});throw new Error((await metadata.json()).error||'Could not save photo metadata')}
    created.push(photo);
   }
   savePhotos([...created,...photos]);
   setCaption('');
   setSharedReady(true);
  }catch(error){setUploadError(error instanceof Error?error.message:'Upload failed')}
  finally{setUploading(false);e.target.value=''}
 };

 const removePhoto=async(id:string)=>{
  const photo=photos.find(p=>p.id===id);
  savePhotos(photos.filter(p=>p.id!==id));
  if(photo&&!photo.url.startsWith('local://')){
   await fetch(`/api/weddings/${encodeURIComponent(slug)}/photos`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:photo.id})}).catch(()=>{});
   await fetch('/api/media',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:photo.id})}).catch(()=>{});
  }
  const next={...previews};delete next[id];setPreviews(next);try{localStorage.setItem(LOCAL_PHOTOS_KEY,JSON.stringify(next))}catch{}
 };

 const visible=activeAlbum==='all'?photos:photos.filter(photo=>photo.albumId===activeAlbum);
 const base=`/wedding/${slug}`;
 const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join(' & ')||'Our Wedding';
 const src=(photo:WeddingPhoto)=>photo.url.startsWith('local://')?previews[photo.id]:photo.url;

 return <main className={dashboard.shell}><WeddingSidebar base={base} active="photos" showOrganiser={modeReady} organiser={organiser} onToggleOrganiser={()=>setMode(!organiser)}/><section className={dashboard.content}>{modeReady&&organiser&&<div className={dashboard.organiserBar}><strong>Organiser mode</strong><span>{sharedReady?'Wedding photos are shared through D1 + private R2 storage.':'Connecting the shared wedding gallery…'}</span><button onClick={()=>setMode(false)}>Preview as guest</button></div>}<header className={dashboard.pageHero}><div><small>{names.toUpperCase()}</small><h1>Wedding photos</h1><p>{formatDateRange(draft.startDate,draft.endDate)} · {draft.city||'Location to be confirmed'}</p></div><Link href={base}>← Wedding home</Link></header><div className={dashboard.pageBody}><section className={styles.uploadComposer}><div className={styles.uploadHero}><div><span>OUR SHARED ALBUM</span><h2>Everyone saw something different.</h2><p>MILNI picks the event happening now. Change the album only when you need to.</p></div></div><div className={styles.uploadOptions}><label>Add to album<select value={uploadAlbum} onChange={e=>{uploadAlbumTouched.current=true;setUploadAlbum(e.target.value)}}><option value="">Wedding gallery</option>{albums.map(album=><option value={album.id} key={album.id}>{album.name}</option>)}</select></label><label>Caption<input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Optional caption"/></label><div className={styles.uploadAction}><span>Tagged as <b>{uploaderName}</b></span><button disabled={uploading} onClick={chooseFiles}>{uploading?'Uploading…':'＋ Add photos'}</button></div></div><input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={filesSelected}/></section>{uploadError&&<p className={styles.uploadError}>{uploadError}</p>}{organiser&&<section className={styles.albumAdmin}><div className={styles.adminHead}><div><span>ORGANISER</span><h2>Photo albums</h2><p>MILNI automatically creates one album for every schedule event. Add extra albums for anything else.</p></div><button onClick={addAlbum}>＋ Add extra album</button></div>{eventAlbums.length>0&&<div className={styles.eventAlbumGrid}>{eventAlbums.map(album=><article key={album.id}><small>AUTO FROM EVENT</small><strong>{album.name}</strong><span>{events.find(event=>event.id===album.eventId)?.label||'Schedule event'}</span><b>{photos.filter(photo=>photo.albumId===album.id).length} photos</b></article>)}</div>}{customAlbums.length>0&&<><div className={styles.additionalHead}>ADDITIONAL ALBUMS</div><div className={styles.albumEditors}>{customAlbums.map(album=><article key={album.id}><label>Album name<input value={album.name} onChange={e=>updateAlbum(album.id,{name:e.target.value})}/></label><label className={styles.wide}>Description<input value={album.description} onChange={e=>updateAlbum(album.id,{description:e.target.value})}/></label><button onClick={()=>removeAlbum(album.id)}>Remove</button></article>)}</div></>}</section>}<div className={styles.filters}><button className={activeAlbum==='all'?styles.active:''} onClick={()=>setActiveAlbum('all')}>All photos <b>{photos.length}</b></button>{albums.map(album=><button className={activeAlbum===album.id?styles.active:''} key={album.id} onClick={()=>setActiveAlbum(album.id)}>{album.name} <b>{photos.filter(photo=>photo.albumId===album.id).length}</b></button>)}</div>{visible.length?<div className={styles.gallery}>{visible.map(photo=><article key={photo.id} onClick={()=>setLightbox(photo)}><img src={src(photo)} alt={photo.caption||'Wedding photo'}/><span className={styles.photoUploader}>{photo.uploadedBy}</span><div><strong>{photo.caption||albums.find(album=>album.id===photo.albumId)?.name||'Wedding memory'}</strong></div>{organiser&&<button onClick={e=>{e.stopPropagation();removePhoto(photo.id)}}>×</button>}</article>)}</div>:<section className={styles.empty}><b>▧</b><h2>The album is waiting for its first memory.</h2><p>Add a photo above and this space will turn into the wedding gallery.</p></section>}<div className={styles.storageNote}><b>Private wedding storage</b><span>New uploads are compressed in your browser, stored privately in Cloudflare R2, and their gallery details are shared through D1. Legacy prototype photos stay in this browser.</span></div></div></section>{showOrganiserLogin&&<div className={dashboard.rsvpOverlay} onMouseDown={e=>{if(e.target===e.currentTarget)setShowOrganiserLogin(false)}}><section className={dashboard.organiserLogin}><button className={dashboard.rsvpClose} onClick={()=>setShowOrganiserLogin(false)} aria-label="Close">×</button><div className={dashboard.eyebrow}>ORGANISER ACCESS</div><h2>Welcome back</h2><p>Sign in to manage albums and organiser-only photo controls.</p><label>Email<input type="email" value={organiserEmail} onChange={e=>setOrganiserEmail(e.target.value)} autoComplete="email"/></label><label>Password<input type="password" value={organiserPassword} onChange={e=>setOrganiserPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void loginOrganiser()}} autoComplete="current-password"/></label>{organiserError&&<div className={dashboard.rsvpError}>{organiserError}</div>}<button className={dashboard.organiserLoginButton} onClick={()=>void loginOrganiser()}>Sign in as organiser</button></section></div>}{lightbox&&<div className={styles.lightbox} onClick={()=>setLightbox(null)}><div onClick={e=>e.stopPropagation()}><button onClick={()=>setLightbox(null)}>×</button><img src={src(lightbox)} alt={lightbox.caption||'Wedding photo'}/><footer><strong>{lightbox.caption||albums.find(album=>album.id===lightbox.albumId)?.name}</strong><span>Shared by {lightbox.uploadedBy}</span></footer></div></div>}</main>;
}

function ensureEventAlbums(draft:WeddingDraft){
 const albums=[...(draft.photoAlbums??[])];
 for(const day of draft.schedule??[])for(const event of day.events){
  const generated:PhotoAlbum={id:`album-${event.id}`,name:event.name,description:`Photos from ${event.name}`,eventId:event.id};
  const index=albums.findIndex(album=>album.eventId===event.id);
  if(index<0)albums.push(generated);
  else if(albums[index].id===generated.id)albums[index]={...albums[index],name:event.name,description:`Photos from ${event.name}`,eventId:event.id};
 }
 return albums;
}

function eventWindow(date:string,start:string,end:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(start))return null;
 const begins=new Date(`${date}T${start}:00`);
 if(Number.isNaN(begins.getTime()))return null;
 const endTime=/^\d{2}:\d{2}$/.test(end)?end:start;
 const finishes=new Date(`${date}T${endTime}:00`);
 if(Number.isNaN(finishes.getTime()))return null;
 if(finishes<=begins)finishes.setDate(finishes.getDate()+1);
 return{begins,finishes};
}

function suggestAlbumForNow(draft:WeddingDraft,albums:PhotoAlbum[],now:Date){
 const timed=(draft.schedule??[]).flatMap(day=>day.events.map(event=>{
  const album=albums.find(item=>item.eventId===event.id);
  const window=eventWindow(day.date,event.start,event.end);
  return album&&window?{albumId:album.id,...window}:null;
 })).filter((item):item is {albumId:string;begins:Date;finishes:Date}=>Boolean(item));
 const active=timed.find(item=>now>=item.begins&&now<=item.finishes);
 if(active)return active.albumId;
 const next=timed.filter(item=>item.begins>now).sort((a,b)=>a.begins.getTime()-b.begins.getTime())[0];
 if(next)return next.albumId;
 const previous=timed.filter(item=>item.finishes<now).sort((a,b)=>b.finishes.getTime()-a.finishes.getTime())[0];
 if(previous)return previous.albumId;
 return albums.find(album=>album.eventId)?.id||albums[0]?.id||'';
}

async function resizeForUpload(file:File){return new Promise<File>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const img=new Image();img.onerror=()=>resolve(file);img.onload=()=>{const max=1800;const scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d')?.drawImage(img,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>resolve(blob?new File([blob],`${file.name.replace(/\.[^.]+$/,'')}.jpg`,{type:'image/jpeg'}):file),'image/jpeg',.82)};img.src=String(reader.result)};reader.readAsDataURL(file)})}
