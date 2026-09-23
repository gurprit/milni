self.addEventListener('push',event=>{
 let payload={};
 try{payload=event.data?event.data.json():{}}catch{payload={title:'MILNI',body:event.data?event.data.text():'You have a new wedding update.'}}
 const title=payload.title||'MILNI';
 const options={
  body:payload.body||'You have a new wedding update.',
  icon:'/milni-icon.svg',
  badge:'/milni-icon.svg',
  tag:payload.tag||'milni-update',
  renotify:Boolean(payload.urgent),
  data:{url:payload.url||'/'},
 };
 event.waitUntil(Promise.all([
  self.registration.showNotification(title,options),
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
   clients.forEach(client=>client.postMessage({type:'MILNI_NOTIFICATION'}));
  }),
 ]));
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data&&event.notification.data.url?event.notification.data.url:'/',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const client of clients){
   if('navigate' in client)await client.navigate(target);
   if('focus' in client)return client.focus();
  }
  return self.clients.openWindow?self.clients.openWindow(target):undefined;
 }));
});
