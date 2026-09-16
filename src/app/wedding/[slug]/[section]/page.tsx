import { notFound } from 'next/navigation';
import WeddingDashboard from '../WeddingDashboard';

const sections=['schedule','events','travel','menu','music','photos','guests','singles','live'] as const;
type Section=typeof sections[number];
export default async function WeddingSectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section as Section))notFound();return <WeddingDashboard section={section as Section}/>}
