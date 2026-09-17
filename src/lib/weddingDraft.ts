export type EventType='Celebration'|'Food'|'Tradition'|'Ceremony'|'Travel'|'Custom';
export type WeddingEvent={id:string;start:string;end:string;name:string;description:string;type:EventType;location?:string};
export type WeddingDay={id:string;label:string;date:string;events:WeddingEvent[]};
export type Guest={id:string;name:string;group:string;status:'Going'|'Awaiting RSVP'|'Not going'};
export type SongRequest={id:string;song:string;likes:number;title?:string;artist?:string;album?:string;artworkUrl?:string;trackUrl?:string;appleTrackId?:number};
export type LocationInfo={name:string;formattedAddress:string;lat?:number;lng?:number;placeId?:string};
export type TravelItem={id:string;name:string;time:string;place:string;note:string;destination?:string;linkedEventId?:string;pickupLocation?:LocationInfo;destinationLocation?:LocationInfo};
export type VenueInfo={name:string;address:string;parking:string;mapUrl?:string;taxiInfo:string;location?:LocationInfo};
export type DietaryTag='Vegetarian'|'Vegan'|'Halal'|'Gluten-free';
export type MenuDish={id:string;name:string;description:string;tags:DietaryTag[];allergens:string};
export type MenuCourse={id:string;name:string;dishes:MenuDish[]};
export type MenuItem={id:string;name:string;subtitle:string;details:string;linkedEventId?:string;courses?:MenuCourse[]};
export type LiveUpdate={id:string;time:string;title:string;message:string};
export type WeddingDraft={partnerOne:string;partnerTwo:string;city:string;startDate:string;endDate:string;title:string;traditions:string[];schedule?:WeddingDay[];guests?:Guest[];songs?:SongRequest[];travel?:TravelItem[];venue?:VenueInfo;menus?:MenuItem[];updates?:LiveUpdate[]};
export const DRAFT_KEY='milni:wedding-draft';
export const emptyDraft:WeddingDraft={partnerOne:'',partnerTwo:'',city:'',startDate:'',endDate:'',title:'',traditions:[],schedule:undefined,guests:[],songs:[],travel:[],venue:undefined,menus:[],updates:[]};
export function readWeddingDraft():WeddingDraft{if(typeof window==='undefined')return emptyDraft;try{return{...emptyDraft,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')}}catch{return emptyDraft}}
export function writeWeddingDraft(next:Partial<WeddingDraft>){if(typeof window==='undefined')return;localStorage.setItem(DRAFT_KEY,JSON.stringify({...readWeddingDraft(),...next}))}
export function weddingSlug(draft:WeddingDraft){const names=[draft.partnerOne,draft.partnerTwo].filter(Boolean).join('-').toLowerCase().normalize('NFKD').replace(/[^a-z0-9-\s]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');return names||'our-wedding'}
export function invitationCode(draft:WeddingDraft){const a=(draft.partnerOne||'MI').replace(/[^a-z]/gi,'').slice(0,3);const b=(draft.partnerTwo||'LNI').replace(/[^a-z]/gi,'').slice(0,3);const year=draft.startDate?draft.startDate.slice(2,4):'27';return`${a}${b}${year}`.toUpperCase()}
export function formatDate(date:string){if(!date)return'';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00`))}
export function formatDateRange(start:string,end:string){if(!start&&!end)return'Dates to be confirmed';if(start===end)return formatDate(start);const s=start?new Date(`${start}T12:00:00`):null,e=end?new Date(`${end}T12:00:00`):null;if(s&&e&&s.getFullYear()===e.getFullYear()&&s.getMonth()===e.getMonth())return`${s.getDate()} – ${e.getDate()} ${new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(e)}`;return[formatDate(start),formatDate(end)].filter(Boolean).join(' – ')}
