import crypto from 'node:crypto';
import {cookies} from 'next/headers';
export const ORGANISER_COOKIE='milni_organiser';
type OrganiserSession={email:string;expiresAt:number};
const secret=()=>process.env.MILNI_SESSION_SECRET||process.env.CLOUDFLARE_D1_API_TOKEN||'';
const sign=(value:string)=>crypto.createHmac('sha256',secret()).update(value).digest('base64url');
export function encodeOrganiserSession(session:OrganiserSession){const payload=Buffer.from(JSON.stringify(session)).toString('base64url');return `${payload}.${sign(payload)}`}
export function decodeOrganiserSession(value?:string):OrganiserSession|null{if(!value||!secret())return null;const[payload,signature]=value.split('.');if(!payload||!signature)return null;const expected=sign(payload);if(signature.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;try{const session=JSON.parse(Buffer.from(payload,'base64url').toString()) as OrganiserSession;return session.expiresAt>Date.now()?session:null}catch{return null}}
export async function currentOrganiserSession(){return decodeOrganiserSession((await cookies()).get(ORGANISER_COOKIE)?.value)}
