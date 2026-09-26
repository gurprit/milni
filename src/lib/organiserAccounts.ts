import {d1Execute,d1Query} from './d1';

export type OrganiserUser={id:string;email:string;name:string;phone:string|null;password_hash:string|null};
export type OrganiserMembership={wedding_id:string;user_id:string;role:string;status:string;claim_token:string|null};

export async function ensureOrganiserSchema(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS organiser_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 )`);
 await d1Execute(`CREATE TABLE IF NOT EXISTS wedding_organisers (
  wedding_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'partner',
  status TEXT NOT NULL DEFAULT 'active',
  claim_token TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wedding_id,user_id)
 )`);
 try{await d1Execute('ALTER TABLE organiser_users ADD COLUMN phone TEXT')}catch{}
 try{await d1Execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_organisers_claim_token ON wedding_organisers(claim_token) WHERE claim_token IS NOT NULL')}catch{}
 try{await d1Execute('CREATE INDEX IF NOT EXISTS idx_wedding_organisers_user ON wedding_organisers(user_id,status)')}catch{}
}

const encoder=new TextEncoder();
const PASSWORD_ITERATIONS=10000;

function arrayBuffer(value:Uint8Array):ArrayBuffer{
 const copy=new Uint8Array(value.byteLength);
 copy.set(value);
 return copy.buffer;
}

async function passwordMaterial(password:string){
 const pepper=process.env.MILNI_SESSION_SECRET||process.env.CLOUDFLARE_D1_API_TOKEN||'';
 if(!pepper)throw new Error('MILNI password pepper is not configured');
 const key=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,encoder.encode(password));
 return new Uint8Array(signed);
}

function randomBase64Url(bytes:number){
 const value=crypto.getRandomValues(new Uint8Array(bytes));
 return Buffer.from(value).toString('base64url');
}

async function derivePassword(material:Uint8Array,salt:Uint8Array,iterations:number){
 const key=await crypto.subtle.importKey('raw',arrayBuffer(material),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:arrayBuffer(salt),iterations},key,256);
 return new Uint8Array(bits);
}

function constantTimeEqual(a:Uint8Array,b:Uint8Array){
 if(a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}

export async function hashOrganiserPassword(password:string){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const material=await passwordMaterial(password);
 const hash=await derivePassword(material,salt,PASSWORD_ITERATIONS);
 return `pbkdf2p$${PASSWORD_ITERATIONS}$${Buffer.from(salt).toString('base64url')}$${Buffer.from(hash).toString('base64url')}`;
}

export async function verifyOrganiserPassword(password:string,stored:string|null|undefined){
 if(!stored)return false;
 const [kind,iterationText,saltText,expectedText]=stored.split('$');
 if(!iterationText||!saltText||!expectedText)return false;
 const iterations=Number(iterationText);
 if(!Number.isFinite(iterations)||iterations<1)return false;
 const salt=new Uint8Array(Buffer.from(saltText,'base64url'));
 const expected=new Uint8Array(Buffer.from(expectedText,'base64url'));
 try{
  const material=kind==='pbkdf2p'?await passwordMaterial(password):kind==='pbkdf2'?encoder.encode(password):null;
  if(!material)return false;
  const actual=await derivePassword(material,salt,iterations);
  return constantTimeEqual(actual,expected);
 }catch{return false}
}

export async function findOrganiserByEmail(email:string){
 await ensureOrganiserSchema();
 return (await d1Query<OrganiserUser>('SELECT id,email,name,phone,password_hash FROM organiser_users WHERE lower(email)=lower(?) LIMIT 1',[email.trim()]))[0];
}

export async function organiserCanAccessWedding(session:{userId?:string}|null|undefined,slug:string){
 if(!session)return false;
 if(!session.userId)return true; // legacy environment organiser remains a superuser during migration.
 const query=()=>d1Query<{id:string}>(`SELECT w.id
  FROM weddings w
  JOIN wedding_organisers wo ON wo.wedding_id=w.id
  WHERE w.slug=? AND wo.user_id=? AND wo.status='active'
  LIMIT 1`,[slug,session.userId!]);
 try{
  return (await query()).length===1;
 }catch(error){
  // Schema creation belongs on the exceptional path, not every authenticated
  // request. This keeps hot API routes comfortably inside Workers CPU limits.
  if(!(error instanceof Error)||!/no such table|no such column/i.test(error.message))throw error;
  await ensureOrganiserSchema();
  return (await query()).length===1;
 }
}

export async function listOrganiserWeddings(userId:string){
 await ensureOrganiserSchema();
 return d1Query<{slug:string;partner_one:string;partner_two:string;title:string|null;city:string|null;start_date:string|null;end_date:string|null;role:string}>(`SELECT w.slug,w.partner_one,w.partner_two,w.title,w.city,w.start_date,w.end_date,wo.role
  FROM wedding_organisers wo
  JOIN weddings w ON w.id=wo.wedding_id
  WHERE wo.user_id=? AND wo.status='active'
  ORDER BY w.updated_at DESC`,[userId]);
}

export function newOrganiserId(){return `organiser-${crypto.randomUUID()}`}
export function newClaimToken(){return randomBase64Url(32)}
