'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Bell,BellRing,X} from 'lucide-react';
import styles from './dashboard.module.scss';

type NotificationItem={
 id:string;
 type:string;
 title:string;
 message:string;
 url:string;
 priority:string;
 created_at:string;
 read_at?:string|null;
};

type PushState='idle'|'enabling'|'enabled'|'disabled'|'denied'|'install'|'unsupported'|'error';

function base64UrlFromBuffer(buffer:ArrayBuffer){
 const bytes=new Uint8Array(buffer);
 let binary='';
 for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function applicationServerKey(value:string){
 const pad='='.repeat((4-(value.length%4))%4);
 const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/')+pad);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}

function subscriptionKeys(subscription:PushSubscription){
 const json=subscription.toJSON();
 const p256dh=json.keys?.p256dh||(subscription.getKey('p256dh')?base64UrlFromBuffer(subscription.getKey('p256dh') as ArrayBuffer):'');
 const auth=json.keys?.auth||(subscription.getKey('auth')?base64UrlFromBuffer(subscription.getKey('auth') as ArrayBuffer):'');
 if(!p256dh||!auth)throw new Error('The browser did not provide push encryption keys.');
 return {p256dh,auth};
}

function timeLabel(value:string){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 const now=new Date();
 const sameDay=date.toDateString()===now.toDateString();
 if(sameDay)return new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(date);
 return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(date);
}

function isIosDevice(){
 if(typeof navigator==='undefined')return false;
 return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}

function isStandalone(){
 if(typeof window==='undefined')return false;
 const navigatorWithStandalone=navigator as Navigator&{standalone?:boolean};
 return window.matchMedia('(display-mode: standalone)').matches||navigatorWithStandalone.standalone===true;
}

async function getRegistration(){
 return navigator.serviceWorker.register('/sw.js',{scope:'/'});
}

export default function NotificationBell({base}:{base:string}){
 const slug=useMemo(()=>base.split('/').filter(Boolean).pop()||'',[base]);
 const[eligible,setEligible]=useState(false);
 const[open,setOpen]=useState(false);
 const[items,setItems]=useState<NotificationItem[]>([]);
 const[unread,setUnread]=useState(0);
 const[pushState,setPushState]=useState<PushState>('idle');
 const[pushMessage,setPushMessage]=useState('');

 const load=useCallback(async()=>{
  try{
   const response=await fetch('/api/notifications/'+encodeURIComponent(slug),{cache:'no-store'});
   if(response.status===401||response.status===403){setEligible(false);return}
   const data=await response.json();
   if(!response.ok)return;
   setEligible(true);
   setItems(data.notifications??[]);
   setUnread(Number(data.unreadCount??0));
  }catch{}
 },[slug]);

 const storeSubscription=useCallback(async(subscription:PushSubscription)=>{
  const keys=subscriptionKeys(subscription);
  const response=await fetch('/api/push/subscribe',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({slug,subscription:{endpoint:subscription.endpoint,keys}}),
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Could not save this push subscription.');
 },[slug]);

 const syncPushState=useCallback(async()=>{
  if(typeof window==='undefined'||!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
   setPushState('unsupported');
   return;
  }
  if(isIosDevice()&&!isStandalone()){
   setPushState('install');
   return;
  }
  if(Notification.permission==='denied'){
   setPushState('denied');
   return;
  }
  try{
   const registration=await getRegistration();
   const subscription=await registration.pushManager.getSubscription();
   if(subscription&&Notification.permission==='granted'){
    await storeSubscription(subscription);
    setPushState('enabled');
   }else setPushState('disabled');
  }catch{
   setPushState('error');
  }
 },[storeSubscription]);

 useEffect(()=>{
  void load();
  void syncPushState();
  const timer=window.setInterval(()=>void load(),30000);
  const onMessage=(event:MessageEvent)=>{if(event.data?.type==='MILNI_NOTIFICATION')void load()};
  if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',onMessage);
  return()=>{
   window.clearInterval(timer);
   if('serviceWorker' in navigator)navigator.serviceWorker.removeEventListener('message',onMessage);
  };
 },[load,syncPushState]);

 const markAllRead=async()=>{
  if(!unread)return;
  setUnread(0);
  setItems(current=>current.map(item=>({...item,read_at:item.read_at||new Date().toISOString()})));
  try{
   await fetch('/api/notifications/'+encodeURIComponent(slug),{
    method:'PATCH',
    headers:{'content-type':'application/json'},
    body:'{}',
   });
  }catch{void load()}
 };

 const toggle=()=>{
  const next=!open;
  setOpen(next);
  if(next)void markAllRead();
 };

 const enablePush=async()=>{
  setPushMessage('');
  if(isIosDevice()&&!isStandalone()){setPushState('install');return}
  if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){setPushState('unsupported');return}
  setPushState('enabling');
  try{
   const permission=await Notification.requestPermission();
   if(permission!=='granted'){setPushState(permission==='denied'?'denied':'disabled');return}
   const keyResponse=await fetch('/api/push/public-key',{cache:'no-store'});
   const keyData=await keyResponse.json();
   if(!keyResponse.ok||!keyData.configured||!keyData.publicKey)throw new Error('Push is not configured on the server yet.');
   const registration=await getRegistration();
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription){
    subscription=await registration.pushManager.subscribe({
     userVisibleOnly:true,
     applicationServerKey:applicationServerKey(keyData.publicKey),
    });
   }
   await storeSubscription(subscription);
   setPushState('enabled');
   setPushMessage('You’ll now get wedding updates even when MILNI is closed.');
  }catch(error){
   console.error('Push enable failed',error);
   setPushState('error');
   setPushMessage(error instanceof Error?error.message:'Could not enable notifications.');
  }
 };



 if(!eligible)return null;

 return <div className={styles.notificationWrap}>
  <button className={styles.notificationButton} type="button" aria-label={unread?String(unread)+' unread notifications':'Notifications'} aria-expanded={open} onClick={toggle}>
   {unread?<BellRing size={18}/>:<Bell size={18}/>}
   {unread>0&&<span>{unread>9?'9+':unread}</span>}
  </button>
  {open&&<section className={styles.notificationPanel}>
   <header>
    <div><small>YOUR WEDDING</small><h2>Notifications</h2></div>
    <button type="button" className={styles.notificationClose} onClick={()=>setOpen(false)} aria-label="Close notifications"><X size={17}/></button>
   </header>

   {pushState!=='enabled'&&<div className={styles.pushCard}>
    {pushState==='install'?<>
     <b>📱 Add MILNI to your Home Screen</b>
     <p>On iPhone and iPad, install MILNI from Safari’s Share menu first. Open the Home Screen app, then tap the bell to turn on wedding notifications.</p>
    </>:pushState==='unsupported'?<>
     <b>Notifications aren’t available in this browser</b>
     <p>You can still find every announcement here in MILNI.</p>
    </>:pushState==='denied'?<>
     <b>Push notifications are blocked</b>
     <p>Allow notifications for MILNI in your browser or device settings, then come back here.</p>
    </>:<>
     <b>Don’t miss a wedding update</b>
     <p>Get live announcements on this device, including timing and transport changes.</p>
     <button type="button" className={styles.pushEnable} disabled={pushState==='enabling'} onClick={enablePush}>{pushState==='enabling'?'Turning on…':'Turn on push notifications'}</button>
    </>}
    {pushMessage&&<small className={styles.pushMessage}>{pushMessage}</small>}
   </div>}

   <div className={styles.notificationList}>
    {items.length===0?<div className={styles.notificationEmpty}><b>All quiet for now.</b><span>New organiser announcements will collect here.</span></div>:items.map(item=>
     <Link key={item.id} href={item.url} className={item.priority==='urgent'?styles.notificationUrgent:''} onClick={()=>setOpen(false)}>
      <span className={styles.notificationGlyph}>{item.priority==='urgent'?'!':'◇'}</span>
      <span className={styles.notificationCopy}>
       {item.priority==='urgent'&&<small>IMPORTANT</small>}
       <b>{item.title}</b>
       <em>{item.message}</em>
       <time>{timeLabel(item.created_at)}</time>
      </span>
     </Link>
    )}
   </div>
  </section>}
 </div>;
}
