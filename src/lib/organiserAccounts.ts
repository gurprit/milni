import crypto from 'node:crypto';
import {d1Execute,d1Query} from './d1';

export type OrganiserUser={id:string;email:string;name:string;password_hash:string|null};
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
 try{await d1Execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_organisers_claim_token ON wedding_organisers(claim_token) WHERE claim_token IS NOT NULL')}catch{}
 try{await d1Execute('CREATE INDEX IF NOT EXISTS idx_wedding_organisers_user ON wedding_organisers(user_id,status)')}catch{}
}

export function hashOrganiserPassword(password:string){
 const salt=crypto.randomBytes(16).toString('base64url');
 const iterations=120000;
 const hash=crypto.pbkdf2Sync(password,salt,iterations,32,'sha256').toString('base64url');
 return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export function verifyOrganiserPassword(password:string,stored:string|null|undefined){
 if(!stored)return false;
 const [kind,iterationText,salt,expected]=stored.split('$');
 if(kind!=='pbkdf2'||!iterationText||!salt||!expected)return false;
 const iterations=Number(iterationText);
 if(!Number.isFinite(iterations)||iterations<1)return false;
 const actual=crypto.pbkdf2Sync(password,salt,iterations,32,'sha256').toString('base64url');
 const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

export async function findOrganiserByEmail(email:string){
 await ensureOrganiserSchema();
 return (await d1Query<OrganiserUser>('SELECT id,email,name,password_hash FROM organiser_users WHERE lower(email)=lower(?) LIMIT 1',[email.trim()]))[0];
}

export async function organiserCanAccessWedding(session:{userId?:string}|null|undefined,slug:string){
 if(!session)return false;
 if(!session.userId)return true; // legacy environment organiser remains a superuser during migration.
 await ensureOrganiserSchema();
 const rows=await d1Query<{id:string}>(`SELECT w.id
  FROM weddings w
  JOIN wedding_organisers wo ON wo.wedding_id=w.id
  WHERE w.slug=? AND wo.user_id=? AND wo.status='active'
  LIMIT 1`,[slug,session.userId]);
 return rows.length===1;
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
export function newClaimToken(){return crypto.randomBytes(32).toString('base64url')}
