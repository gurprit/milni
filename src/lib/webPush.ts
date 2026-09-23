type PushSubscriptionRecord={
 endpoint:string;
 p256dh:string;
 auth:string;
};

type PushPayload={
 title:string;
 body:string;
 url:string;
 tag?:string;
 urgent?:boolean;
};

const encoder=new TextEncoder();

function arrayBuffer(value:Uint8Array):ArrayBuffer{
 const copy=new Uint8Array(value.byteLength);
 copy.set(value);
 return copy.buffer;
}

function decodeBase64Url(value:string){
 const pad='='.repeat((4-(value.length%4))%4);
 const binary=atob(value.replace(/-/g,'+').replace(/_/g,'/')+pad);
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes;
}

function encodeBase64Url(value:Uint8Array){
 let binary='';
 for(let i=0;i<value.length;i++)binary+=String.fromCharCode(value[i]);
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function concatBytes(...parts:Uint8Array[]){
 const length=parts.reduce((total,part)=>total+part.length,0);
 const result=new Uint8Array(length);
 let offset=0;
 for(const part of parts){result.set(part,offset);offset+=part.length}
 return result;
}

async function hmac(keyBytes:Uint8Array,data:Uint8Array){
 const key=await crypto.subtle.importKey('raw',arrayBuffer(keyBytes),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return new Uint8Array(await crypto.subtle.sign('HMAC',key,arrayBuffer(data)));
}

async function expand(prk:Uint8Array,info:Uint8Array,length:number){
 return (await hmac(prk,concatBytes(info,new Uint8Array([1])))).slice(0,length);
}

async function vapidToken(endpoint:string,publicKey:string,privateKey:string,subject:string){
 const publicBytes=decodeBase64Url(publicKey);
 const privateBytes=decodeBase64Url(privateKey);
 if(publicBytes.length!==65||publicBytes[0]!==4||privateBytes.length!==32)throw new Error('Invalid VAPID key pair');

 const key=await crypto.subtle.importKey('jwk',{
  kty:'EC',
  crv:'P-256',
  x:encodeBase64Url(publicBytes.slice(1,33)),
  y:encodeBase64Url(publicBytes.slice(33,65)),
  d:encodeBase64Url(privateBytes),
  ext:true,
  key_ops:['sign'],
 },{name:'ECDSA',namedCurve:'P-256'},false,['sign']);

 const header=encodeBase64Url(encoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const payload=encodeBase64Url(encoder.encode(JSON.stringify({
  aud:new URL(endpoint).origin,
  exp:Math.floor(Date.now()/1000)+(12*60*60),
  sub:subject,
 })));
 const unsigned=encoder.encode(`${header}.${payload}`);
 const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,unsigned));
 return `${header}.${payload}.${encodeBase64Url(signature)}`;
}

async function encryptPayload(subscription:PushSubscriptionRecord,payload:string){
 const uaPublic=decodeBase64Url(subscription.p256dh);
 const authSecret=decodeBase64Url(subscription.auth);
 if(uaPublic.length!==65||uaPublic[0]!==4)throw new Error('Invalid push subscription public key');

 const uaKey=await crypto.subtle.importKey('raw',arrayBuffer(uaPublic),{name:'ECDH',namedCurve:'P-256'},false,[]);
 const serverKeys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']) as CryptoKeyPair;
 const serverPublic=new Uint8Array(await crypto.subtle.exportKey('raw',serverKeys.publicKey));
 const sharedSecret=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},serverKeys.privateKey,256));

 const prkKey=await hmac(authSecret,sharedSecret);
 const keyInfo=concatBytes(encoder.encode('WebPush: info'),new Uint8Array([0]),uaPublic,serverPublic);
 const ikm=await expand(prkKey,keyInfo,32);

 const salt=crypto.getRandomValues(new Uint8Array(16));
 const prk=await hmac(salt,ikm);
 const cek=await expand(prk,concatBytes(encoder.encode('Content-Encoding: aes128gcm'),new Uint8Array([0])),16);
 const nonce=await expand(prk,concatBytes(encoder.encode('Content-Encoding: nonce'),new Uint8Array([0])),12);

 const plaintext=concatBytes(encoder.encode(payload),new Uint8Array([2]));
 if(plaintext.length+16>=4096)throw new Error('Push payload is too large');

 const aesKey=await crypto.subtle.importKey('raw',arrayBuffer(cek),{name:'AES-GCM'},false,['encrypt']);
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:arrayBuffer(nonce),tagLength:128},aesKey,arrayBuffer(plaintext)));

 const header=new Uint8Array(21+serverPublic.length);
 header.set(salt,0);
 new DataView(header.buffer).setUint32(16,4096);
 header[20]=serverPublic.length;
 header.set(serverPublic,21);
 return concatBytes(header,ciphertext);
}

export function pushConfigured(){
 return Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
}

export function vapidPublicKey(){
 return process.env.VAPID_PUBLIC_KEY||'';
}

export async function sendWebPush(subscription:PushSubscriptionRecord,payload:PushPayload){
 const publicKey=process.env.VAPID_PUBLIC_KEY;
 const privateKey=process.env.VAPID_PRIVATE_KEY;
 const subject=process.env.VAPID_SUBJECT;
 if(!publicKey||!privateKey||!subject)throw new Error('VAPID is not configured');

 const json=JSON.stringify(payload);
 const body=await encryptPayload(subscription,json);
 const jwt=await vapidToken(subscription.endpoint,publicKey,privateKey,subject);
 return fetch(subscription.endpoint,{
  method:'POST',
  headers:{
   Authorization:`vapid t=${jwt}, k=${publicKey}`,
   'Content-Encoding':'aes128gcm',
   'Content-Type':'application/octet-stream',
   TTL:'86400',
   Urgency:payload.urgent?'high':'normal',
  },
  body,
 });
}
