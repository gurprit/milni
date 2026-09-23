import {d1Execute,d1Query} from './d1';
import {pushConfigured,sendWebPush} from './webPush';

export type NotificationRow={
 id:string;
 type:string;
 title:string;
 message:string;
 url:string;
 priority:string;
 created_at:string;
 read_at?:string|null;
};

type PushRow={
 id:string;
 endpoint:string;
 p256dh:string;
 auth:string;
};

export async function ensureNotificationTables(){
 await d1Execute(`CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL,
  recipient_guest_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  url TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  source_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_notifications_wedding_created ON notifications(wedding_id, created_at DESC)');
 await d1Execute(`CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (notification_id, guest_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
 )`);
 await d1Execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  wedding_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE
 )`);
 await d1Execute('CREATE INDEX IF NOT EXISTS idx_push_subscriptions_wedding ON push_subscriptions(wedding_id)');
}

export async function savePushSubscription(input:{weddingId:string;guestId:string;endpoint:string;p256dh:string;auth:string}){
 await ensureNotificationTables();
 const now=new Date().toISOString();
 await d1Execute(`INSERT INTO push_subscriptions (id,wedding_id,guest_id,endpoint,p256dh,auth,created_at,updated_at)
 VALUES (?,?,?,?,?,?,?,?)
 ON CONFLICT(endpoint) DO UPDATE SET wedding_id=excluded.wedding_id,guest_id=excluded.guest_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at`,[
  crypto.randomUUID(),input.weddingId,input.guestId,input.endpoint,input.p256dh,input.auth,now,now
 ]);
}

export async function removePushSubscription(endpoint:string,guestId:string){
 await ensureNotificationTables();
 await d1Execute('DELETE FROM push_subscriptions WHERE endpoint=? AND guest_id=?',[endpoint,guestId]);
}

export async function listGuestNotifications(weddingId:string,guestId:string){
 await ensureNotificationTables();
 return d1Query<NotificationRow>(`SELECT n.id,n.type,n.title,n.message,n.url,n.priority,n.created_at,r.read_at
 FROM notifications n
 LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.guest_id=?
 WHERE n.wedding_id=? AND (n.recipient_guest_id IS NULL OR n.recipient_guest_id=?)
 ORDER BY n.created_at DESC LIMIT 40`,[guestId,weddingId,guestId]);
}

export async function markGuestNotificationsRead(weddingId:string,guestId:string,notificationId?:string){
 await ensureNotificationTables();
 const now=new Date().toISOString();
 if(notificationId){
  await d1Execute(`INSERT OR IGNORE INTO notification_reads (notification_id,guest_id,read_at)
  SELECT id,?,? FROM notifications WHERE id=? AND wedding_id=? AND (recipient_guest_id IS NULL OR recipient_guest_id=?)`,[guestId,now,notificationId,weddingId,guestId]);
  return;
 }
 await d1Execute(`INSERT OR IGNORE INTO notification_reads (notification_id,guest_id,read_at)
 SELECT id,?,? FROM notifications WHERE wedding_id=? AND (recipient_guest_id IS NULL OR recipient_guest_id=?)`,[guestId,now,weddingId,guestId]);
}

export async function publishWeddingNotification(input:{
 weddingId:string;
 type:string;
 title:string;
 message:string;
 url:string;
 priority?:'normal'|'urgent';
 sourceId?:string;
 recipientGuestId?:string|null;
}){
 await ensureNotificationTables();
 const id=crypto.randomUUID();
 const createdAt=new Date().toISOString();
 const priority=input.priority==='urgent'?'urgent':'normal';
 await d1Execute(`INSERT INTO notifications (id,wedding_id,recipient_guest_id,type,title,message,url,priority,source_id,created_at)
 VALUES (?,?,?,?,?,?,?,?,?,?)`,[
  id,input.weddingId,input.recipientGuestId??null,input.type,input.title,input.message,input.url,priority,input.sourceId??null,createdAt
 ]);

 if(!pushConfigured())return {id,createdAt,pushAttempted:false};

 const params:(string|null)[]=[input.weddingId];
 let sql='SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE wedding_id=?';
 if(input.recipientGuestId){sql+=' AND guest_id=?';params.push(input.recipientGuestId)}
 const subscriptions=await d1Query<PushRow>(sql,params);
 let delivered=0;

 for(let i=0;i<subscriptions.length;i+=20){
  const batch=subscriptions.slice(i,i+20);
  const results=await Promise.allSettled(batch.map(async subscription=>{
   const response=await sendWebPush(subscription,{
    title:input.title,
    body:input.message,
    url:input.url,
    tag:id,
    urgent:priority==='urgent',
   });
   if(response.status===404||response.status===410){
    await d1Execute('DELETE FROM push_subscriptions WHERE id=?',[subscription.id]);
    return false;
   }
   if(!response.ok)throw new Error(`Push service returned ${response.status}`);
   return true;
  }));
  delivered+=results.filter(result=>result.status==='fulfilled'&&result.value).length;
  for(const result of results)if(result.status==='rejected')console.error('Push delivery failed',result.reason);
 }

 return {id,createdAt,pushAttempted:true,delivered};
}
