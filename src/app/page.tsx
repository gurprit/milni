'use client';

import {
  CSSProperties,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';

type BurstKind = 'start' | 'join';

type ConfettiParticle = {
  id: number;
  kind: BurstKind;
  burstX: number;
  burstY: number;
  fallX: number;
  fallY: number;
  depth: number;
  endDepth: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  endSpinX: number;
  endSpinY: number;
  endSpinZ: number;
  scale: number;
  endScale: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  color: string;
  radius: string;
  blur: number;
};

const CONFETTI_COLORS = [
  '#d7a75f',
  '#f0c98d',
  '#0b5f50',
  '#6e9d91',
  '#d98e8e',
  '#f7e7cf',
];

const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

const particleStyle = (particle: ConfettiParticle) =>
  ({
    '--burst-x': particle.burstX + 'px',
    '--burst-y': particle.burstY + 'px',
    '--fall-x': particle.fallX + 'px',
    '--fall-y': particle.fallY + 'px',
    '--depth': particle.depth + 'px',
    '--end-depth': particle.endDepth + 'px',
    '--spin-x': particle.spinX + 'deg',
    '--spin-y': particle.spinY + 'deg',
    '--spin-z': particle.spinZ + 'deg',
    '--end-spin-x': particle.endSpinX + 'deg',
    '--end-spin-y': particle.endSpinY + 'deg',
    '--end-spin-z': particle.endSpinZ + 'deg',
    '--scale': String(particle.scale),
    '--end-scale': String(particle.endScale),
    '--delay': particle.delay + 'ms',
    '--duration': particle.duration + 'ms',
    '--particle-color': particle.color,
    '--blur': particle.blur + 'px',
    width: particle.width + 'px',
    height: particle.height + 'px',
    borderRadius: particle.radius,
  }) as CSSProperties;

export default function LandingPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);

  const particleId = useRef(0);
  const timers = useRef<number[]>([]);

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
    return timer;
  };

  useEffect(() => {
    const openJoin = () => setOpen(true);
    window.addEventListener('milni:join-wedding', openJoin);

    return () => {
      window.removeEventListener('milni:join-wedding', openJoin);
      timers.current.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  const burstConfetti = (kind: BurstKind, amount = 18) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // The two buttons throw confetti away from one another, then gravity takes over.
    const direction = kind === 'start' ? -1 : 1;

    const nextParticles = Array.from({length: amount}, () => {
      const burstX =
        direction * randomBetween(24, 92) + randomBetween(-18, 18);
      const burstY = -randomBetween(44, 118);
      const depth = randomBetween(-90, 120);
      const scale = randomBetween(0.55, 1.28);

      return {
        id: ++particleId.current,
        kind,
        burstX,
        burstY,
        fallX:
          burstX +
          direction * randomBetween(34, 112) +
          randomBetween(-42, 42),
        fallY: randomBetween(190, 320),
        depth,
        endDepth: randomBetween(-120, 70),
        spinX: randomBetween(-280, 280),
        spinY: randomBetween(-360, 360),
        spinZ: randomBetween(-240, 240),
        endSpinX: randomBetween(-760, 760),
        endSpinY: randomBetween(-900, 900),
        endSpinZ: randomBetween(-680, 680),
        scale,
        endScale: scale * randomBetween(0.72, 0.98),
        delay: randomBetween(0, 90),
        duration: randomBetween(1350, 1900),
        width: randomBetween(4, 9),
        height: randomBetween(7, 15),
        color:
          CONFETTI_COLORS[
            Math.floor(Math.random() * CONFETTI_COLORS.length)
          ],
        radius:
          Math.random() > 0.78 ? '999px' : Math.random() > 0.45 ? '2px' : '1px',
        blur: depth < -30 ? randomBetween(0.45, 1.1) : 0,
      };
    });

    const ids = new Set(nextParticles.map(particle => particle.id));
    setParticles(current => [...current, ...nextParticles].slice(-100));

    schedule(() => {
      setParticles(current =>
        current.filter(particle => !ids.has(particle.id)),
      );
    }, 2100);
  };

  const handleStartPlanning = (
    event: ReactMouseEvent<HTMLAnchorElement>,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    burstConfetti('start', 20);
    schedule(() => router.push('/create'), 280);
  };

  const handleJoinOpen = () => {
    burstConfetti('join', 20);
    schedule(() => setOpen(true), 260);
  };

  const renderConfetti = (kind: BurstKind) => (
    <span className={styles.confettiLayer} aria-hidden="true">
      {particles
        .filter(particle => particle.kind === kind)
        .map(particle => (
          <span
            className={styles.confettiPiece}
            key={particle.id}
            style={particleStyle(particle)}
          />
        ))}
    </span>
  );

  const join = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/guest-session', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name, code}),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not join wedding.');
      }

      router.push('/wedding/' + result.weddingSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join wedding.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.lotus}>♢</span>
          <strong>MILNI</strong>
          <small>PEOPLE · TRADITIONS · TOGETHER</small>
        </div>
        <div className={styles.navActions}>
          <a href="/organiser">Organiser sign in</a>
          <a href="/create">Create your wedding</a>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>YOUR WEDDING · IN ONE PLACE</p>
          <h1>
            Different families.
            <br />
            One beautiful story.
          </h1>
          <p className={styles.intro}>
            Plan every event, keep every guest informed and bring everyone
            together in a private wedding space built around your traditions.
          </p>

          <div className={styles.actions}>
            <a
              className={styles.primary}
              href="/create"
              onPointerEnter={event => {
                if (event.pointerType === 'mouse') burstConfetti('start', 12);
              }}
              onFocus={event => {
                if (event.currentTarget.matches(':focus-visible')) {
                  burstConfetti('start', 12);
                }
              }}
              onClick={handleStartPlanning}
            >
              <span className={styles.buttonLabel}>Start planning →</span>
              {renderConfetti('start')}
            </a>

            <button
              type="button"
              className={styles.secondary}
              onPointerEnter={event => {
                if (event.pointerType === 'mouse') burstConfetti('join', 12);
              }}
              onFocus={event => {
                if (event.currentTarget.matches(':focus-visible')) {
                  burstConfetti('join', 12);
                }
              }}
              onClick={handleJoinOpen}
            >
              <span className={styles.buttonLabel}>Join a wedding</span>
              {renderConfetti('join')}
            </button>

            <a className={styles.organiserLink} href="/organiser">
              Organiser sign in
            </a>
          </div>
        </div>

        <aside className={styles.card}>
          <span>THE WEDDING WEEKEND</span>
          <h2>
            Everything your guests need, without the group-chat archaeology.
          </h2>
          <div className={styles.features}>
            <p>Schedule & ceremonies</p>
            <p>Travel & coaches</p>
            <p>Live updates</p>
            <p>Menus & dietary info</p>
            <p>Song requests</p>
            <p>Shared memories</p>
          </div>
        </aside>
      </section>

      {open && (
        <div
          className={styles.joinOverlay}
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <form className={styles.joinModal} onSubmit={join}>
            <button
              type="button"
              className={styles.joinClose}
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <p className={styles.eyebrow}>JOIN A WEDDING</p>
            <h2>Welcome to MILNI</h2>
            <p>
              Enter your name exactly as it appears on the guest list and the
              invitation code shared by the couple.
            </p>
            <label>
              Your full name
              <input
                autoFocus
                autoComplete="name"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="e.g. Aman Kapoor"
                required
              />
            </label>
            <label>
              Invitation code
              <input
                value={code}
                onChange={event => setCode(event.target.value.toUpperCase())}
                placeholder="Wedding code"
                required
              />
            </label>
            {error && <div className={styles.joinError}>{error}</div>}
            <button
              className={styles.joinSubmit}
              disabled={busy || !name.trim() || !code.trim()}
            >
              {busy ? 'Finding your wedding…' : 'Join wedding →'}
            </button>
            <small>
              Have a personal invitation link or QR? Open that instead for
              instant access.
            </small>
          </form>
        </div>
      )}
    </main>
  );
}
