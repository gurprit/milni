'use client';

import {useEffect,useRef,useState} from 'react';
import {Search,X} from 'lucide-react';
import {createPortal} from 'react-dom';
import styles from './gif-picker.module.scss';

type GifResult={
 id:string;
 title:string;
 url:string;
 previewUrl:string;
};

type Props={
 selectedUrl?:string;
 onSelect:(url:string)=>void;
 onClear?:()=>void;
 disabled?:boolean;
 label?:string;
 compact?:boolean;
};

type GiphyImage={url?:string};
type GiphyItem={
 id?:string;
 title?:string;
 images?:{
  downsized_medium?:GiphyImage;
  fixed_width?:GiphyImage;
  fixed_width_small?:GiphyImage & {webp?:string};
  original?:GiphyImage;
 };
};

const GIPHY_API_KEY=process.env.NEXT_PUBLIC_GIPHY_API_KEY||'';

export default function GifPicker({selectedUrl='',onSelect,onClear,disabled=false,label='+ GIF',compact=false}:Props){
 const[open,setOpen]=useState(false);
 const[query,setQuery]=useState('');
 const[results,setResults]=useState<GifResult[]>([]);
 const[loading,setLoading]=useState(false);
 const[error,setError]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);

 useEffect(()=>{
  if(!open)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  window.addEventListener('keydown',onKey);
  window.setTimeout(()=>inputRef.current?.focus(),0);
  return()=>window.removeEventListener('keydown',onKey);
 },[open]);

 useEffect(()=>{
  if(!open){setLoading(false);return}
  const term=query.trim();
  if(!term){setResults([]);setError('');return}
  if(!GIPHY_API_KEY){setResults([]);setError('GIF search needs NEXT_PUBLIC_GIPHY_API_KEY.');return}
  const controller=new AbortController();
  const timer=window.setTimeout(async()=>{
   setLoading(true);setError('');
   try{
    const params=new URLSearchParams({api_key:GIPHY_API_KEY,q:term,limit:'24',rating:'pg-13',lang:'en'});
    const response=await fetch('https://api.giphy.com/v1/gifs/search?'+params.toString(),{signal:controller.signal});
    if(!response.ok)throw new Error('GIF search is unavailable right now.');
    const data=await response.json() as {data?:GiphyItem[]};
    const mapped=(data.data??[]).flatMap((item,index)=>{
     const url=item.images?.downsized_medium?.url||item.images?.fixed_width?.url||item.images?.original?.url||'';
     if(!url)return[];
     return[{id:item.id||String(index),title:item.title||'GIF',url,previewUrl:item.images?.fixed_width_small?.webp||item.images?.fixed_width?.url||url}];
    });
    setResults(mapped);
   }catch(searchError){
    if(searchError instanceof DOMException&&searchError.name==='AbortError')return;
    setResults([]);setError(searchError instanceof Error?searchError.message:'GIF search failed.');
   }finally{if(!controller.signal.aborted)setLoading(false)}
  },300);
  return()=>{window.clearTimeout(timer);controller.abort()};
 },[open,query]);

 const choose=(url:string)=>{onSelect(url);setOpen(false);setQuery('');setResults([]);setError('')};
 const clear=()=>{onClear?.();};

 return <div className={compact?styles.compact:styles.root}>
  <button type="button" className={styles.trigger} disabled={disabled} onClick={()=>setOpen(true)}>{label}</button>
  {selectedUrl&&<div className={styles.attachment}><img src={selectedUrl} alt="Selected GIF"/><button type="button" onClick={clear} aria-label="Remove GIF"><X size={13}/></button></div>}
  {open&&typeof document!=='undefined'&&createPortal(<div className={styles.backdrop} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
   <section className={styles.panel} role="dialog" aria-modal="true" aria-label="Choose a GIF">
    <header><div><span>ADD A GIF</span><h3>Find the right reaction</h3></div><button type="button" className={styles.close} onClick={()=>setOpen(false)} aria-label="Close GIF picker"><X size={20}/></button></header>
    <label className={styles.search}><Search size={18}/><input ref={inputRef} value={query} onChange={event=>setQuery(event.target.value.slice(0,50))} placeholder="Search GIFs by keyword…" autoComplete="off"/></label>
    <div className={styles.status}>{loading?'Searching…':error||(query.trim()&&!results.length?'No GIFs found.':'Search for a mood, moment or reaction.')}</div>
    {results.length>0&&<div className={styles.grid}>{results.map(gif=><button type="button" key={gif.id} title={gif.title} onClick={()=>choose(gif.url)}><img src={gif.previewUrl} alt={gif.title}/></button>)}</div>}
    <footer>Powered by <strong>GIPHY</strong></footer>
   </section>
  </div>,document.body)}
 </div>;
}
