import { NextRequest, NextResponse } from 'next/server';

type ITunesTrack={trackId:number;trackName:string;artistName:string;collectionName?:string;artworkUrl100?:string;trackViewUrl?:string;primaryGenreName?:string};

async function searchStorefront(term:string,country:'GB'|'IN'){
 const url=new URL('https://itunes.apple.com/search');
 url.searchParams.set('term',term);url.searchParams.set('entity','song');url.searchParams.set('media','music');url.searchParams.set('limit','12');url.searchParams.set('country',country);
 const response=await fetch(url,{next:{revalidate:3600}});
 if(!response.ok)return [] as ITunesTrack[];
 const data=await response.json() as {results?:ITunesTrack[]};
 return data.results??[];
}

export async function GET(request:NextRequest){
 const term=(request.nextUrl.searchParams.get('q')??'').trim();
 if(term.length<2)return NextResponse.json({results:[]});
 try{
  // Search both the UK and India storefronts so Punjabi, Hindi and other Indian music
  // remains discoverable alongside the UK catalogue.
  const [uk,india]=await Promise.all([searchStorefront(term,'GB'),searchStorefront(term,'IN')]);
  const seen=new Set<number>();
  const combined=[...india,...uk].filter(track=>{if(!track.trackId||seen.has(track.trackId))return false;seen.add(track.trackId);return true}).slice(0,10);
  return NextResponse.json({results:combined.map(track=>({id:track.trackId,title:track.trackName,artist:track.artistName,album:track.collectionName??'',artworkUrl:(track.artworkUrl100??'').replace('100x100bb','300x300bb'),trackUrl:track.trackViewUrl??'',genre:track.primaryGenreName??''}))});
 }catch{return NextResponse.json({results:[]},{status:200})}
}
