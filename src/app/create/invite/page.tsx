import Link from 'next/link';
import InviteSetup from './InviteSetup';
import styles from './page.module.scss';

export default function InvitePage(){
  return <main className={styles.page}>
    <header><Link href="/">MILNI <small>PEOPLE · TRADITIONS · TOGETHER</small></Link><span>Organiser setup</span></header>
    <section className={styles.content}><InviteSetup /></section>
  </main>;
}
