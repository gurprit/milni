import { notFound } from 'next/navigation';
import WeddingDashboard from '../WeddingDashboard';
import TravelPage from '../TravelPage';
import MenuPage from '../MenuPage';
import EventsPage from '../EventsPage';
import MusicPage from '../MusicPage';
import PhotosPage from '../PhotosPage';
import GuestsPage from '../GuestsPage';
import SinglesPage from '../SinglesPage';
import LivePage from '../LivePage';
import MomentsPage from '../MomentsPage';

const sections=['schedule','events','travel','menu','music','photos','moments','guests','singles','live'] as const;
type Section=typeof sections[number];
export default async function WeddingSectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section as Section))notFound();if(section==='travel')return <TravelPage/>;if(section==='menu')return <MenuPage/>;if(section==='events')return <EventsPage/>;if(section==='music')return <MusicPage/>;if(section==='photos')return <PhotosPage/>;if(section==='moments')return <MomentsPage/>;if(section==='guests')return <GuestsPage/>;if(section==='singles')return <SinglesPage/>;if(section==='live')return <LivePage/>;return <WeddingDashboard section="schedule"/>}
