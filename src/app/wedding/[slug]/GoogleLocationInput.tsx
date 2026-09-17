'use client';

import { useEffect, useRef, useState } from 'react';
import type { LocationInfo } from '../../../lib/weddingDraft';

declare global {
 interface Window { google?: any; __milniGoogleMapsPromise?: Promise<void> }
}

function loadGoogleMaps(){
 if(typeof window==='undefined')return Promise.resolve();
 if(window.google?.maps?.places)return Promise.resolve();
 if(window.__milniGoogleMapsPromise)return window.__milniGoogleMapsPromise;
 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
 if(!key)return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
 window.__milniGoogleMapsPromise=new Promise((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-milni-google-maps]');
  if(existing){existing.addEventListener('load',()=>resolve());existing.addEventListener('error',()=>reject(new Error('Google Maps failed to load')));return}
  const script=document.createElement('script');
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
  script.async=true;script.defer=true;script.dataset.milniGoogleMaps='true';
  script.onload=()=>resolve();script.onerror=()=>reject(new Error('Google Maps failed to load'));
  document.head.appendChild(script);
 });
 return window.__milniGoogleMapsPromise;
}

export function GoogleLocationInput({value,placeholder,onChange,onSelect}:{value:string;placeholder?:string;onChange:(value:string)=>void;onSelect:(location:LocationInfo)=>void}){
 const inputRef=useRef<HTMLInputElement>(null);
 const autocompleteRef=useRef<any>(null);
 const [available,setAvailable]=useState(true);
 useEffect(()=>{
  let active=true;
  loadGoogleMaps().then(()=>{
   if(!active||!inputRef.current||autocompleteRef.current)return;
   const autocomplete=new window.google.maps.places.Autocomplete(inputRef.current,{fields:['place_id','name','formatted_address','geometry'],types:['geocode','establishment']});
   autocompleteRef.current=autocomplete;
   autocomplete.addListener('place_changed',()=>{
    const place=autocomplete.getPlace();
    const lat=place.geometry?.location?.lat?.();
    const lng=place.geometry?.location?.lng?.();
    const formattedAddress=place.formatted_address||inputRef.current?.value||'';
    onSelect({name:place.name||formattedAddress,formattedAddress,lat,lng,placeId:place.place_id});
   });
  }).catch(()=>active&&setAvailable(false));
  return()=>{active=false};
 },[onSelect]);
 return <><input ref={inputRef} value={value} placeholder={placeholder} autoComplete="off" onChange={e=>onChange(e.target.value)}/>{!available&&<small>Address suggestions unavailable. Check the Google Maps API key.</small>}</>;
}

export function GoogleMap({location,label,className}:{location?:LocationInfo;label:string;className?:string}){
 const mapRef=useRef<HTMLDivElement>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{loadGoogleMaps().then(()=>setReady(true)).catch(()=>setReady(false))},[]);
 useEffect(()=>{
  if(!ready||!mapRef.current||location?.lat==null||location?.lng==null)return;
  const centre={lat:location.lat,lng:location.lng};
  const map=new window.google.maps.Map(mapRef.current,{center:centre,zoom:15,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:'cooperative'});
  new window.google.maps.Marker({map,position:centre,title:label});
 },[ready,location?.lat,location?.lng,label]);
 if(location?.lat==null||location?.lng==null)return <div className={className}><span>{location?.formattedAddress||'Choose an address to show the map'}</span></div>;
 return <div ref={mapRef} className={className} aria-label={`Map of ${label}`}/>;
}

export function googleDirectionsUrl(location:LocationInfo){
 if(location.placeId)return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.formattedAddress)}&destination_place_id=${encodeURIComponent(location.placeId)}`;
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.formattedAddress)}`;
}
