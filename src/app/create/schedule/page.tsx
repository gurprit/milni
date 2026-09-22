import Link from 'next/link';
import ScheduleBuilder from './ScheduleBuilder';
import styles from './page.module.scss';

export default function SchedulePage(){
  return <main className={styles.page}>
    <header><Link href="/">MILNI <small>PEOPLE · TRADITIONS · TOGETHER</small></Link><span>Organiser setup</span></header>
    <section className={styles.content}><ScheduleBuilder /></section>
  </main>;
}
