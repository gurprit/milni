'use client';

import { useMemo, useState } from 'react';
import type { Guest, GuestSide, GuestStatus } from '../../../lib/weddingDraft';
import styles from './guests.module.scss';

type Mode='single'|'household'|'import';
type InviteLink={id:string;name:string;link:string};

const SIDES:GuestSide[]=['Partner one','Partner two','Both'];

function makeId(index=0){
 const suffix=typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID().slice(0,8):`${Date.now()}-${index}`;
 return `guest-${suffix}`;
}

function makeGuest(input:Partial<Guest>&Pick<Guest,'name'>,index=0):Guest{
 return {
  id:input.id||makeId(index),
  name:input.name.trim(),
  group:(input.group||'Friends').trim()||'Friends',
  status:input.status||'Awaiting RSVP',
  side:input.side||'Both',
  email:input.email?.trim()||'',
  phone:input.phone?.trim()||'',
  dietary:input.dietary?.trim()||'',
  plusOne:input.plusOne?.trim()||'',
  notes:input.notes?.trim()||''
 };
}

function parseTable(text:string):string[][]{
 const source=text.replace(/\r\n?/g,'\n').trim();
 if(!source)return[];
 const firstLine=source.split('\n',1)[0]||'';
 const delimiter=firstLine.includes('\t')?'\t':',';
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(ch==='"'){
   if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
  }else if(ch===delimiter&&!quoted){row.push(cell.trim());cell=''}
  else if(ch==='\n'&&!quoted){row.push(cell.trim());rows.push(row);row=[];cell=''}
  else cell+=ch;
 }
 row.push(cell.trim());rows.push(row);
 return rows.filter(r=>r.some(Boolean));
}

function importedGuests(text:string):Guest[]{
 const rows=parseTable(text);if(!rows.length)return[];
 const first=rows[0].map(v=>v.toLowerCase().trim());
 const hasHeader=first.some(v=>['name','guest','guest name','full name'].includes(v));
 const headers=hasHeader?first:['name','group','email','phone','side','dietary','plus one','notes','status'];
 const data=hasHeader?rows.slice(1):rows;
 const at=(row:string[],aliases:string[])=>{const index=headers.findIndex(h=>aliases.includes(h));return index>=0?(row[index]||''):''};
 return data.map((row,index)=>{
  const sideRaw=at(row,['side','wedding side']).toLowerCase();
  const side:GuestSide=sideRaw.includes('one')||sideRaw==='1'?'Partner one':sideRaw.includes('two')||sideRaw==='2'?'Partner two':'Both';
  const statusRaw=at(row,['status','rsvp','rsvp status']).toLowerCase();
  const status:GuestStatus=statusRaw.includes('not')||statusRaw.includes('declin')?'Not going':statusRaw==='going'||statusRaw.includes('confirm')?'Going':'Awaiting RSVP';
  return makeGuest({
   name:at(row,['name','guest','guest name','full name']),
   group:at(row,['group','household','family'])||'Friends',
   email:at(row,['email','email address']),
   phone:at(row,['phone','mobile','telephone']),
   side,
   dietary:at(row,['dietary','dietary requirements','diet']),
   plusOne:at(row,['plus one','plusone','partner']),
   notes:at(row,['notes','organiser notes']),
   status
  },index);
 }).filter(g=>g.name);
}

export default function AddGuestsModal({slug,onClose,onAdd}:{slug:string;onClose:()=>void;onAdd:(guests:Guest[])=>Promise<boolean>}){
 const[mode,setMode]=useState<Mode>('single');
 const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 const[added,setAdded]=useState<Guest[]>([]);const[inviteLinks,setInviteLinks]=useState<InviteLink[]>([]);const[inviteBusy,setInviteBusy]=useState(false);

 const[single,setSingle]=useState({name:'',group:'Friends',email:'',phone:'',side:'Both' as GuestSide,dietary:'',plusOne:'',notes:''});
 const[household,setHousehold]=useState({group:'',names:'',email:'',phone:'',side:'Both' as GuestSide,dietary:'',notes:''});
 const[importText,setImportText]=useState('');
 const preview=useMemo(()=>importedGuests(importText),[importText]);

 const build=()=>{
  if(mode==='single')return single.name.trim()?[makeGuest(single)]:[];
  if(mode==='household')return household.names.split(/\n+/).map(v=>v.trim()).filter(Boolean).map((name,index)=>makeGuest({name,group:household.group||'Family',email:household.email,phone:household.phone,side:household.side,dietary:household.dietary,notes:household.notes},index));
  return preview;
 };

 const save=async()=>{const next=build();if(!next.length){setError(mode==='import'?'Add or paste at least one guest row.':'Add at least one guest name.');return}setBusy(true);setError('');try{const synced=await onAdd(next);if(!synced)throw new Error('Guests were saved on this device, but MILNI could not sync them to the wedding yet.');setAdded(next)}catch(e){setError(e instanceof Error?e.message:'Could not add guests.')}finally{setBusy(false)}};
 const createInvites=async()=>{setInviteBusy(true);setError('');try{const links:InviteLink[]=[];for(const guest of added){const response=await fetch(`/api/invitations/${encodeURIComponent(slug)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({guestId:guest.id})});const result=await response.json();if(!response.ok)throw new Error(result.error||`Could not create invitation for ${guest.name}.`);links.push({id:guest.id,name:guest.name,link:result.link})}setInviteLinks(links)}catch(e){setError(e instanceof Error?e.message:'Could not create invitations.')}finally{setInviteBusy(false)}};
 const copyLinks=async()=>{if(!inviteLinks.length)return;await navigator.clipboard.writeText(inviteLinks.map(item=>`${item.name}: ${item.link}`).join('\n'))};
 const reset=()=>{setAdded([]);setInviteLinks([]);setError('');setSingle({name:'',group:'Friends',email:'',phone:'',side:'Both',dietary:'',plusOne:'',notes:''});setHousehold({group:'',names:'',email:'',phone:'',side:'Both',dietary:'',notes:''});setImportText('')};

 if(added.length)return <div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={styles.addGuestsModal}><button className={styles.close} onClick={onClose}>×</button><div className={styles.eyebrow}>GUESTS ADDED</div><h2>{added.length===1?'Guest added':'Guest list updated'} ✓</h2><p className={styles.addGuestsLead}>{added.map(g=>g.name).join(' · ')}</p><div className={styles.addGuestSuccess}><strong>What next?</strong><p>Create personal invitation links now, or manage them later from the Invitation centre.</p>{inviteLinks.length?<><div className={styles.generatedInvites}>{inviteLinks.map(item=><div key={item.id}><span>{item.name}</span><button onClick={()=>navigator.clipboard.writeText(item.link)}>Copy link</button></div>)}</div><button className={styles.primaryAction} onClick={copyLinks}>Copy all invitation links</button></>:<button className={styles.primaryAction} disabled={inviteBusy} onClick={createInvites}>{inviteBusy?'Creating invitations…':'Create personal invitations'}</button>}<a className={styles.secondaryAction} href={`/wedding/${slug}/invite`}>Open Invitation centre →</a></div>{error&&<div className={styles.addGuestError}>{error}</div>}<div className={styles.addGuestFooter}><button onClick={reset}>＋ Add more guests</button><button onClick={onClose}>Done</button></div></section></div>;

 return <div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={styles.addGuestsModal}><button className={styles.close} onClick={onClose}>×</button><div className={styles.eyebrow}>BUILD YOUR GUEST LIST</div><h2>Add guests</h2><p className={styles.addGuestsLead}>Add one person, a whole household, or bring in a list from a spreadsheet. Add an email or mobile number for guests who will use the shared printed-invitation QR.</p><div className={styles.addGuestTabs}><button className={mode==='single'?styles.addGuestTabActive:''} onClick={()=>{setMode('single');setError('')}}>One guest</button><button className={mode==='household'?styles.addGuestTabActive:''} onClick={()=>{setMode('household');setError('')}}>Household / family</button><button className={mode==='import'?styles.addGuestTabActive:''} onClick={()=>{setMode('import');setError('')}}>CSV / Excel</button></div>

 {mode==='single'&&<div className={styles.addGuestForm}><label className={styles.full}>Guest name<input autoFocus value={single.name} onChange={e=>setSingle({...single,name:e.target.value})} placeholder="e.g. Aman Kapoor"/></label><label>Group / household<input value={single.group} onChange={e=>setSingle({...single,group:e.target.value})} placeholder="Friends, Kapoor family…"/></label><label>Side<select value={single.side} onChange={e=>setSingle({...single,side:e.target.value as GuestSide})}>{SIDES.map(side=><option key={side}>{side}</option>)}</select></label><label>Email<input type="email" value={single.email} onChange={e=>setSingle({...single,email:e.target.value})}/></label><label>Phone<input value={single.phone} onChange={e=>setSingle({...single,phone:e.target.value})}/></label><label>Plus one / partner<input value={single.plusOne} onChange={e=>setSingle({...single,plusOne:e.target.value})}/></label><label>Dietary requirements<input value={single.dietary} onChange={e=>setSingle({...single,dietary:e.target.value})}/></label><label className={styles.full}>Private organiser notes<textarea rows={2} value={single.notes} onChange={e=>setSingle({...single,notes:e.target.value})}/></label></div>}

 {mode==='household'&&<div className={styles.addGuestForm}><label className={styles.full}>Household / family name<input value={household.group} onChange={e=>setHousehold({...household,group:e.target.value})} placeholder="e.g. Kapoor family"/></label><label className={styles.full}>Guest names<textarea autoFocus rows={6} value={household.names} onChange={e=>setHousehold({...household,names:e.target.value})} placeholder={"Aman Kapoor\nSimran Kapoor\nNina Kapoor"}/><small>One person per line. Each gets their own RSVP and invitation link. A shared email or phone can also let the household identify themselves after scanning the general wedding QR.</small></label><label>Shared email<input type="email" value={household.email} onChange={e=>setHousehold({...household,email:e.target.value})}/></label><label>Shared phone<input value={household.phone} onChange={e=>setHousehold({...household,phone:e.target.value})}/></label><label>Side<select value={household.side} onChange={e=>setHousehold({...household,side:e.target.value as GuestSide})}>{SIDES.map(side=><option key={side}>{side}</option>)}</select></label><label>Dietary note<input value={household.dietary} onChange={e=>setHousehold({...household,dietary:e.target.value})} placeholder="Optional shared note"/></label><label className={styles.full}>Private organiser notes<textarea rows={2} value={household.notes} onChange={e=>setHousehold({...household,notes:e.target.value})}/></label></div>}

 {mode==='import'&&<div className={styles.importGuests}><div className={styles.importHelp}><strong>Paste from Excel or Google Sheets</strong><p>Copy rows straight from a spreadsheet, or upload a CSV/TSV file. Recognised columns include Name, Group, Email, Phone, Side, Dietary, Plus One, Notes and Status.</p><label className={styles.fileButton}>Choose CSV / TSV<input type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setImportText(String(reader.result||''));reader.readAsText(file);e.currentTarget.value=''}}/></label></div><textarea className={styles.importTextarea} rows={9} value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"Name\tGroup\tEmail\tPhone\nAman Kapoor\tKapoor family\taman@example.com\t07123 456789"}/>{preview.length>0&&<div className={styles.importPreview}><strong>{preview.length} guest{preview.length===1?'':'s'} ready to import</strong><span>{preview.slice(0,5).map(g=>g.name).join(' · ')}{preview.length>5?` · +${preview.length-5} more`:''}</span></div>}</div>}

 {error&&<div className={styles.addGuestError}>{error}</div>}<div className={styles.addGuestFooter}><button onClick={onClose}>Cancel</button><button className={styles.primaryAction} disabled={busy} onClick={save}>{busy?'Adding guests…':mode==='single'?'Add guest':mode==='household'?'Add household':`Import ${preview.length||''} guest${preview.length===1?'':'s'}`}</button></div></section></div>;
}
