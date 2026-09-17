import { notFound } from 'next/navigation';
import WeddingDashboard from '../WeddingDashboard';
import TravelPage from '../TravelPage';
import MenuPage from '../MenuPage';
import EventsPage from '../EventsPage';

const sections=['schedule','events','travel','menu','music','photos','guests','singles','live'] as const;
type Section=typeof sections[number];
export default async function WeddingSectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section as Section))notFound();if(section==='travel')return <TravelPage/>;if(section==='menu')return <MenuPage/>;if(section==='events')return <EventsPage/>;return <WeddingDashboard section={section as Section}/>}
