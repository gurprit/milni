'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Heart } from 'lucide-react';
import OrganiserLoginModal from './OrganiserLoginModal';
import WeddingSidebar from './WeddingSidebar';
import { SongRequest, WeddingDraft, emptyDraft, formatDateRange, readWeddingDraft, writeWeddingDraft } from '../../../lib/weddingDraft';
import dashboard from './dashboard.module.scss';
import styles from './music.module.scss';

const VIEW_MODE_KEY='milni:view-mode';
const SONG_VOTES_KEY='milni:song-votes';
const nav=[['home','⌂','Home'],['schedule','▣','Schedule'],['events','✦','Events'],['travel','▤','Travel'],['menu','♨','Menu'],['music','♫','Music'],['photos','▧','Photos'],['guests','♧','Guests'],['singles','♡','Singles'],['live','♢','Live'],['invite','✉','Invitation']] as const;
type SearchResult={id:number;title:string;artist:string;album:string;artworkUrl:string;trackUrl:string;genre:string};
type ConfettiPiece={id:number;songId:string;x:number;peak:number;fall:number;r:number;s:number;delay:number;sway:number;drift:number};
const starterSongs:SongRequest[]=['Mundian To Bach Ke · Panjabi MC','Nachde Ne Saare · Jasleen Royal','This Will Be · Natalie Cole'].map((song,i)=>({id:`song-${i}`,song,likes:12-i*3}));

function boardDate(now=new Date()){
 const shifted=new Date(now);shifted.setHours(shifted.getHours()-5);
 return `${shifted.getFullYear()}-${String(shifted.getMonth()+1).padStart(2,'0')}-${String(shifted.getDate()).padStart(2,'0')}`;
}
function boardLabel(draft:WeddingDraft,date:string){const day=draft.schedule?.find(item=>item.date===date);return day?.label||new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${date}T12:00:00`))}
function songVotesKey(slug:string,date:string){return `${SONG_VOTES_KEY}:${slug}:${date}`}
function currentEventLabel(draft:WeddingDraft,date:string,now=new Date()){
 const day=draft.schedule?.find(item=>item.date===date);if(!day)return'';
 const minutes=now.getHours()*60+now.getMinutes();
 const candidates=day.events.map(event=>{const [h,m]=event.start.split(':').map(Number);return{event,start:h*60+m}}).filter(item=>Number.isFinite(item.start)&&item.start<=minutes).sort((a,b)=>b.start-a.start);
 return candidates[0]?.event.name||day.events[0]?.name||'';
}

export default function MusicPage(){
 const [draft,setDraft]=useState<WeddingDraft>(emptyDraft);const [organiser,setOrganiser]=useState(false);const [organiserAuthed,setOrganiserAuthed]=useState(false);const [showOrganiserLogin,setShowOrganiserLogin]=useState(false);const [modeReady,setModeReady]=useState(false);const [query,setQuery]=useState('');const [results,setResults]=useState<SearchResult[]>([]);const [searching,setSearching]=useState(false);const [open,setOpen]=useState(false);const [likedSongs,setLikedSongs]=useState<Set<string>>(new Set());const [confetti,setConfetti]=useState<ConfettiPiece[]>([]);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const confettiId=useRef(0);const likedSongsRef=useRef<Set<string>>(new Set());const songsRef=useRef<SongRequest[]>([]);const params=useParams();const slug=String(params.slug||'our-wedding');
 useEffect(()=>{const loaded=readWeddingDraft();const today=boardDate();let next=loaded;if(loaded.songBoardDate&&loaded.songBoardDate!==today){const oldSongs=loaded.songs??[];const archives=oldSongs.length?[...(loaded.songArchives??[]),{id:`archive-${loaded.songBoardDate}`,boardDate:loaded.songBoardDate,label:boardLabel(loaded,loaded.songBoardDate),songs:oldSongs}]:loaded.songArchives??[];next={...loaded,songs:[],songBoardDate:today,songArchives:archives};writeWeddingDraft({songs:[],songBoardDate:today,songArchives:archives})}else if(!loaded.songBoardDate){next={...loaded,songBoardDate:today};writeWeddingDraft({songBoardDate:today})}setDraft(next);try{const stored=JSON.parse(localStorage.getItem(songVotesKey(slug,today))||'[]') as string[];const liked=new Set(stored.filter(id=>typeof id==='string'));likedSongsRef.current=liked;setLikedSongs(liked)}catch{likedSongsRef.current=new Set();setLikedSongs(new Set())}void fetch('/api/organiser-session',{cache:'no-store'}).then(r=>r.json()).then(x=>{const authed=!!x.organiser;setOrganiserAuthed(authed);setOrganiser(authed&&localStorage.getItem(VIEW_MODE_KEY)==='organiser');setModeReady(true)}).catch(()=>setModeReady(true));return()=>{if(timer.current)clearTimeout(timer.current)}},[slug]);
 const setMode=(next:boolean)=>{if(next&&!organiserAuthed){setShowOrganiserLogin(true);return}setOrganiser(next);localStorage.setItem(VIEW_MODE_KEY,next?'organiser':'guest')};
 const today=boardDate();const hasStoredBoard=draft.songBoardDate!=null;const songs=draft.songs?.length?draft.songs:hasStoredBoard?[]:starterSongs;songsRef.current=songs;const dayLabel=boardLabel(draft,today);const eventLabel=currentEventLabel(draft,today);
 const saveSongs=(next:SongRequest[])=>{setDraft(current=>({...current,songs:next,songBoardDate:today}));writeWeddingDraft({songs:next,songBoardDate:today})};
 const search=(value:string)=>{setQuery(value);if(timer.current)clearTimeout(timer.current);if(value.trim().length<2){setResults([]);setOpen(false);return}setSearching(true);timer.current=setTimeout(async()=>{try{const response=await fetch(`/api/music-search?q=${encodeURIComponent(value.trim())}`);const data=await response.json();setResults(data.results??[]);setOpen(true)}finally{setSearching(false)}},280)};
 const addResult=(result:SearchResult)=>{const duplicate=songs.some(song=>song.appleTrackId===result.id);if(duplicate){setQuery('');setOpen(false);return}const next:SongRequest={id:`song-${Date.now()}`,song:`${result.title} · ${result.artist}`,title:result.title,artist:result.artist,album:result.album,artworkUrl:result.artworkUrl,trackUrl:result.trackUrl,appleTrackId:result.id,likes:0};saveSongs([next,...songs]);setQuery('');setResults([]);setOpen(false)};
 const addManual=()=>{if(!query.trim())return;saveSongs([{id:`song-${Date.now()}`,song:query.trim(),likes:0},...songs]);setQuery('');setOpen(false)};
 const vote=(id:string)=>{
  const currentLikes=likedSongsRef.current;
  const nextLiked=!currentLikes.has(id);
  const nextLikes=new Set(currentLikes);
  if(nextLiked)nextLikes.add(id);else nextLikes.delete(id);
  likedSongsRef.current=nextLikes;setLikedSongs(nextLikes);
  try{localStorage.setItem(songVotesKey(slug,today),JSON.stringify([...nextLikes]))}catch{}
  const nextSongs=songsRef.current.map(song=>song.id===id?{...song,likes:Math.max(0,song.likes+(nextLiked?1:-1))}:song);
  songsRef.current=nextSongs;saveSongs(nextSongs);
  if(nextLiked&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   const pieces=Array.from({length:14},()=>({id:++confettiId.current,songId:id,x:(Math.random()-.5)*115,peak:-45-Math.random()*70,fall:115+Math.random()*80,r:(Math.random()>.5?1:-1)*(300+Math.random()*500),s:.6+Math.random()*.75,delay:Math.random()*100,sway:7+Math.random()*10,drift:(Math.random()-.5)*24}));
   setConfetti(v=>[...v,...pieces]);window.setTimeout(()=>setConfetti(v=>v.filter(p=>!pieces.some(n=>n.id===p.id))),6200);
  }
 };
 const likeBurst=(songId:string)=>confetti.filter(p=>p.songId===songId).map(p=><i key={p.id} className={styles.likeConfetti} style={{'--cx':p.x+'px','--peak':p.peak+'px','--fall':p.fall+'px','--cr':p.r+'deg','--cs':String(p.s),'--delay':p.delay+'ms','--sway':p.sway+'px','--drift':p.drift+'px'} as React.CSSProperties}><b/></i>);
 const remove=(id:string)=>saveSongs(songs.filter(song=>song.id!==id));
 const base=`/wedding/${slug}`;const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join(' & ')||'Our Wedding';
 return <main className={dashboard.shell}><WeddingSidebar base={base} active="music" showOrganiser={modeReady} organiser={organiser} onToggleOrganiser={()=>setMode(!organiser)}/><section className={dashboard.content}>{modeReady&&organiser&&<div className={dashboard.organiserBar}><strong>Organiser mode</strong><span>You’re editing the wedding. Changes on this prototype are saved in this browser.</span><button onClick={()=>setMode(false)}>Preview as guest</button></div>}<header className={dashboard.pageHero}><div><small>{names.toUpperCase()}</small><h1>Song requests</h1><p>{formatDateRange(draft.startDate,draft.endDate)} · {draft.city||'Location to be confirmed'}</p></div><Link href={base}>← Wedding home</Link></header><div className={dashboard.pageBody}><div className={styles.boardBanner}><div><span>TODAY'S REQUEST BOARD</span><strong>{eventLabel||dayLabel}</strong><small>{eventLabel&&dayLabel!==eventLabel?dayLabel:''}</small></div><p>Requests and votes stay live through the night, then this board starts fresh automatically at <b>5:00am</b>.</p></div><div className={styles.layout}><section className={styles.requestCard}><div className={styles.eyebrow}>THE SOUNDTRACK</div><h2>What gets you dancing?</h2><p>Search by song or artist. MILNI searches both UK and Indian music catalogues, so Punjabi, Hindi and other Indian tracks can join the dance floor too.</p><div className={styles.searchBox}><span>⌕</span><input value={query} onChange={e=>search(e.target.value)} onFocus={()=>results.length&&setOpen(true)} placeholder="Try ‘Mundian To Bach Ke’ or ‘Diljit Dosanjh’"/>{searching&&<i/>}</div>{open&&<div className={styles.results}>{results.length?results.map(result=><button key={`${result.id}-${result.title}`} onClick={()=>addResult(result)}><Artwork src={result.artworkUrl} title={result.title}/><span><strong>{result.title}</strong><small>{result.artist}</small><em>{result.album}</em></span><b>＋</b></button>):!searching&&<div className={styles.noResult}>No exact match. <button onClick={addManual}>Add “{query}” manually</button></div>}</div>}<small className={styles.catalogueNote}>♫ Album artwork and track details are matched automatically.</small></section><section className={styles.requests}><div className={styles.listHead}><div><div className={styles.eyebrow}>GUEST REQUESTS</div><h2>{eventLabel?`${eventLabel} playlist`:'Wedding playlist'}</h2></div><span>{songs.length} request{songs.length===1?'':'s'}</span></div>{songs.length===0?<div className={styles.emptyBoard}><b>♫</b><h3>Fresh dance floor, fresh requests.</h3><p>Be the first guest to add a song for today.</p></div>:<div className={styles.songList}>{[...songs].sort((a,b)=>b.likes-a.likes).map(song=><article className={styles.song} key={song.id}><Artwork src={song.artworkUrl} title={song.title||song.song}/><div className={styles.songInfo}><strong>{song.title||song.song.split(' · ')[0]}</strong><span>{song.artist||song.song.split(' · ').slice(1).join(' · ')}</span>{song.album&&<small>{song.album}</small>}</div><button className={`${styles.vote} ${likedSongs.has(song.id)?styles.voted:''}`} aria-label={likedSongs.has(song.id)?'Remove vote':'Upvote song'} aria-pressed={likedSongs.has(song.id)} onClick={()=>vote(song.id)}><span><Heart size={18} fill={likedSongs.has(song.id)?'currentColor':'none'}/>{likeBurst(song.id)}</span><b>{song.likes}</b></button>{organiser&&<button className={styles.remove} onClick={()=>remove(song.id)}>Remove</button>}</article>)}</div>}{organiser&&(draft.songArchives?.length??0)>0&&<details className={styles.archives}><summary>Previous request boards <span>{draft.songArchives?.length}</span></summary>{[...(draft.songArchives??[])].reverse().map(archive=><div className={styles.archive} key={archive.id}><strong>{archive.label}</strong><span>{archive.songs.length} request{archive.songs.length===1?'':'s'}</span><small>{[...archive.songs].sort((a,b)=>b.likes-a.likes).slice(0,3).map(song=>`${song.title||song.song.split(' · ')[0]} (${song.likes})`).join(' · ')}</small></div>)}</details>}</section></div></div></section>{showOrganiserLogin&&<OrganiserLoginModal onClose={()=>setShowOrganiserLogin(false)} onSuccess={()=>{setOrganiserAuthed(true);setShowOrganiserLogin(false);setOrganiser(true);localStorage.setItem(VIEW_MODE_KEY,'organiser')}}/>}</main>;
}

function Artwork({src,title}:{src?:string;title:string}){return src?<img className={styles.artwork} src={src} alt=""/>:<div className={styles.artworkFallback} aria-label={`${title} artwork`}>♫</div>}
