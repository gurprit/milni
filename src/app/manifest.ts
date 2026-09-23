import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{
 return{
  name:'MILNI · People. Traditions. Together.',
  short_name:'MILNI',
  description:'Your private wedding space for schedules, live updates, guests and celebrations.',
  start_url:'/',
  display:'standalone',
  background_color:'#f7f3ed',
  theme_color:'#00483e',
  icons:[{
   src:'/milni-icon.svg',
   sizes:'any',
   type:'image/svg+xml',
   purpose:'any',
  }],
 };
}
