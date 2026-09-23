'use client';

import { useEffect, useRef, useState } from 'react';
import type { LocationInfo } from '../../../lib/weddingDraft';
import styles from './google-location.module.scss';

declare global {
 interface Window { google?: any; __milniGoogleMapsPromise?: Promise<void> }
}

function loadGoogleMaps(){
 if(typeof window==='undefined')return Promise.resolve();
 if(window.google?.maps?.importLibrary)return Promise.all([
  window.google.maps.importLibrary('maps'),
  window.google.maps.importLibrary('places')
 ]).then(()=>undefined);
 if(window.__milniGoogleMapsPromise)return window.__milniGoogleMapsPromise;

 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
 if(!key)return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));

 window.__milniGoogleMapsPromise=new Promise((resolve,reject)=>{
  const finish=async()=>{
   try{
    if(!window.google?.maps?.importLibrary)throw new Error('Google Maps importLibrary unavailable');
    await Promise.all([
     window.google.maps.importLibrary('maps'),
     window.google.maps.importLibrary('places')
    ]);
    resolve();
   }catch(error){reject(error)}
  };

  const existing=document.querySelector<HTMLScriptElement>('script[data-milni-google-maps]');
  if(existing){
   if(window.google?.maps?.importLibrary){void finish();return}
   existing.addEventListener('load',()=>void finish(),{once:true});
   existing.addEventListener('error',()=>reject(new Error('Google Maps failed to load')),{once:true});
   return;
  }

  const script=document.createElement('script');
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
  script.async=true;
  script.defer=true;
  script.dataset.milniGoogleMaps='true';
  script.onload=()=>void finish();
  script.onerror=()=>reject(new Error('Google Maps failed to load'));
  document.head.appendChild(script);
 });

 return window.__milniGoogleMapsPromise;
}

type PlacePrediction=any;

export function GoogleLocationInput({value,placeholder,onChange,onSelect}:{value:string;placeholder?:string;onChange:(value:string)=>void;onSelect:(location:LocationInfo)=>void}){
 const onChangeRef=useRef(onChange);
 const onSelectRef=useRef(onSelect);
 const tokenRef=useRef<any>(null);
 const requestIdRef=useRef(0);
 const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [available,setAvailable]=useState(true);
 const [ready,setReady]=useState(false);
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [suggestions,setSuggestions]=useState<PlacePrediction[]>([]);

 onChangeRef.current=onChange;
 onSelectRef.current=onSelect;

 useEffect(()=>{
  let active=true;
  loadGoogleMaps().then(async()=>{
   if(!active)return;
   const places=await window.google.maps.importLibrary('places');
   if(!places?.AutocompleteSuggestion||!places?.AutocompleteSessionToken)throw new Error('Places API (New) autocomplete unavailable');
   tokenRef.current=new places.AutocompleteSessionToken();
   setReady(true);
  }).catch(error=>{
   console.error('MILNI Google Places failed to initialise',error);
   if(active)setAvailable(false);
  });
  return()=>{
   active=false;
   if(timerRef.current)clearTimeout(timerRef.current);
  };
 },[]);

 const fetchSuggestions=(input:string)=>{
  if(timerRef.current)clearTimeout(timerRef.current);
  const trimmed=input.trim();
  if(!trimmed||trimmed.length<2||!ready){
   setSuggestions([]);
   setOpen(false);
   setLoading(false);
   return;
  }

  const requestId=++requestIdRef.current;
  setLoading(true);
  timerRef.current=setTimeout(()=>{
   void (async()=>{
    try{
     const places=await window.google.maps.importLibrary('places');
     if(!tokenRef.current)tokenRef.current=new places.AutocompleteSessionToken();
     const result=await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input:trimmed,
      sessionToken:tokenRef.current
     });
     if(requestId!==requestIdRef.current)return;
     const predictions=(result?.suggestions??[]).map((item:any)=>item.placePrediction).filter(Boolean);
     setSuggestions(predictions);
     setOpen(predictions.length>0);
     setAvailable(true);
    }catch(error){
     if(requestId!==requestIdRef.current)return;
     console.error('MILNI Google Places autocomplete failed',error);
     setSuggestions([]);
     setOpen(false);
     setAvailable(false);
    }finally{
     if(requestId===requestIdRef.current)setLoading(false);
    }
   })();
  },180);
 };

 const choose=async(prediction:PlacePrediction)=>{
  try{
   setLoading(true);
   const places=await window.google.maps.importLibrary('places');
   const place=prediction.toPlace();
   await place.fetchFields({fields:['id','displayName','formattedAddress','location']});
   const formattedAddress=place.formattedAddress||prediction.text?.toString?.()||value;
   const lat=place.location?.lat?.();
   const lng=place.location?.lng?.();
   onSelectRef.current({
    name:place.displayName||formattedAddress,
    formattedAddress,
    lat,
    lng,
    placeId:place.id
   });
   setSuggestions([]);
   setOpen(false);
   tokenRef.current=new places.AutocompleteSessionToken();
   setAvailable(true);
  }catch(error){
   console.error('MILNI Google Places selection failed',error);
   setAvailable(false);
  }finally{
   setLoading(false);
  }
 };

 return <div className={styles.wrap}>
  <input
   value={value}
   placeholder={placeholder}
   autoComplete="off"
   aria-autocomplete="list"
   aria-expanded={open}
   onFocus={()=>suggestions.length&&setOpen(true)}
   onBlur={()=>window.setTimeout(()=>setOpen(false),160)}
   onChange={e=>{
    const next=e.target.value;
    onChangeRef.current(next);
    fetchSuggestions(next);
   }}
  />
  {loading&&<span className={styles.loading}>Searching Google…</span>}
  {open&&suggestions.length>0&&<div className={styles.suggestions} role="listbox">
   {suggestions.map((prediction,index)=><button
    type="button"
    role="option"
    key={prediction.placeId||prediction.text?.toString?.()||index}
    onMouseDown={e=>e.preventDefault()}
    onClick={()=>void choose(prediction)}
   >
    <span>{prediction.text?.toString?.()||'Location'}</span>
   </button>)}
   <small>Powered by Google</small>
  </div>}
  {!available&&<small className={styles.error}>Google address search is unavailable. Check that Maps JavaScript API and Places API (New) are enabled for this key.</small>}
 </div>;
}

export function GoogleMap({location,label,className}:{location?:LocationInfo;label:string;className?:string}){
 const mapRef=useRef<HTMLDivElement>(null);
 const [ready,setReady]=useState(false);

 useEffect(()=>{
  loadGoogleMaps().then(()=>setReady(true)).catch(error=>{
   console.error('MILNI Google Map failed to initialise',error);
   setReady(false);
  });
 },[]);

 useEffect(()=>{
  if(!ready||!mapRef.current||location?.lat==null||location?.lng==null)return;
  const centre={lat:location.lat,lng:location.lng};
  const MapConstructor=window.google?.maps?.Map;
  if(typeof MapConstructor!=='function')return;
  const map=new MapConstructor(mapRef.current,{
   center:centre,
   zoom:15,
   mapTypeControl:false,
   streetViewControl:false,
   fullscreenControl:false,
   gestureHandling:'cooperative'
  });
  const MarkerConstructor=window.google?.maps?.Marker;
  if(typeof MarkerConstructor==='function')new MarkerConstructor({map,position:centre,title:label});
 },[ready,location?.lat,location?.lng,label]);

 if(location?.lat==null||location?.lng==null)return <div className={className}><span>{location?.formattedAddress||'Choose an address to show the map'}</span></div>;
 return <div ref={mapRef} className={className} aria-label={`Map of ${label}`}/>;
}

export function googleDirectionsUrl(location:LocationInfo){
 if(location.placeId)return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.formattedAddress)}&destination_place_id=${encodeURIComponent(location.placeId)}`;
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.formattedAddress)}`;
}
