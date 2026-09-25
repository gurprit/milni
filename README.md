# MILNI

> **People. Traditions. Together.**

**MILNI** is a private, wedding-scoped social platform for Indian weddings.

It gives couples and organisers one place to run the wedding weekend, while giving guests a personalised space for schedules, invitations, live updates, travel, food, photos, music and even a private wedding-only Singles area.

🌐 **Live:** [milne.app](https://milne.app)

---

## ✨ What MILNI does

Instead of scattering wedding information across WhatsApp groups, PDFs, screenshots, spreadsheets and half-remembered conversations, MILNI gives every wedding its own private digital home.

The experience is split into two connected journeys:

### Organisers

Organisers can:

- Create and customise a wedding space
- Build a multi-day wedding schedule
- Add ceremonies, celebrations, meals, travel and custom events
- Explain traditions and events for guests
- Control which guests or groups can see specific events
- View event-level RSVP attendance
- Manage the guest list
- Publish live announcements and urgent updates
- Configure transport and venue information
- Manage menus and dietary information
- Collect song requests
- Create event-based photo albums
- Upload wedding and event photography
- Change the invitation / home-page hero image
- Switch into **Preview as guest** mode
- Use responsive organiser tools on desktop and mobile

### Guests

Guests get a personalised wedding experience with:

- Private wedding access
- Personal invitation details
- Wedding and event RSVP
- A personalised home page
- Full wedding schedule
- Ceremony and event information
- Venue and directions information
- Coach / transport details
- Menus and dietary information
- Song requests
- Wedding photo albums
- Guest list
- Live organiser announcements
- In-app notification centre
- Native-style Web Push notifications
- An optional private wedding-only **Singles** experience

---

## 🎞️ GIF search

Moment posts and replies, Live announcements and Singles match chats share the same **+ GIF** picker, backed by GIPHY search.

For local builds, copy `.env.example` to `.env.local` and add a GIPHY web API key:

```bash
NEXT_PUBLIC_GIPHY_API_KEY=your_key_here
```

The picker keeps GIFs on GIPHY's CDN rather than uploading them to MILNI storage, and displays the required GIPHY attribution in the search UI.

---

## 🔔 Notifications

MILNI includes both an in-app notification centre and standard **Web Push**.

Current notification triggers include:

- Live organiser announcements
- Urgent wedding updates
- New Singles matches
- New Singles chat messages

Push notifications deep-link guests directly to the relevant part of MILNI.

Singles message notifications intentionally **do not expose the message body on the lock screen**. They identify the sender and tell the recipient that a new message is waiting.

Web Push is currently tested on:

- Android / Chrome
- Desktop Chrome
- iPhone and iPad when MILNI is installed to the Home Screen

See [docs/push-notifications.md](docs/push-notifications.md) for the VAPID setup and implementation notes.

---

## 💘 MILNI Singles

Singles is an optional, private micro-dating experience inside a wedding.

Guests can:

1. Opt in
2. Create a small profile
3. Browse other opted-in wedding guests
4. Like profiles privately
5. Match when the interest is mutual
6. Chat only after matching

Profiles and conversations are scoped to the wedding rather than forming a public dating network.

---

## 📸 Photos

MILNI's photo experience is organised around the wedding schedule.

- Albums are automatically created from wedding events
- The relevant current event can be selected automatically
- Organisers can create additional albums
- Guest/uploader identity is attached automatically
- Images are stored using Cloudflare R2

---

## 📱 PWA

MILNI is built as a web-first Progressive Web App.

The app includes:

- Responsive desktop and mobile layouts
- Persistent mobile navigation
- Installable PWA manifest
- Service worker
- Web Push
- Standalone Home Screen support
- Mobile-first guest experience

The goal is to make MILNI feel much closer to a native wedding app without requiring guests to install something from an app store.

---

## 🧱 Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 |
| UI | React 19 |
| Language | TypeScript |
| Styling | SCSS Modules |
| Icons | Lucide React |
| Runtime / deployment | Cloudflare Workers |
| Next.js adapter | vinext |
| Database | Cloudflare D1 |
| Media storage | Cloudflare R2 |
| Push | Web Push + VAPID |
| PWA | Service Worker + Web App Manifest |
| Maps | Google Maps / Places |
| Validation / forms | Zod + React Hook Form |

MILNI deliberately keeps the notification system standards-based. Push delivery does not require Firebase or a paid notification provider.

---

## 🚀 Getting started

Clone the repository and install dependencies:

```bash
git clone https://github.com/gurprit/milni.git
cd milni
npm install
```

Start local development:

```bash
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
```

---

## 🔐 Environment variables

MILNI uses environment variables for Cloudflare services, sessions, maps and Web Push.

A local `.env.local` may include:

```env
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_D1_DATABASE_ID=
CLOUDFLARE_D1_API_TOKEN=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

MILNI_SESSION_SECRET=
MILNI_ORGANISER_EMAIL=
MILNI_ORGANISER_PASSWORD=

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

> [!IMPORTANT]
> Never commit production secrets or the VAPID private key to the repository.

For Cloudflare production secrets:

```bash
npx wrangler secret put SECRET_NAME
```

---

## 🔑 Generate VAPID keys

MILNI includes a small dependency-free VAPID key generator:

```bash
node scripts/generate-vapid.mjs
```

Then store the generated values in Cloudflare:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

---

## ☁️ Deploy

Build the Cloudflare version:

```bash
npm run build
```

Deploy:

```bash
npm run deploy
```

The deployment pipeline uses **vinext** to build the Next.js application for Cloudflare Workers.

---

## 🗺️ Main product areas

```text
Wedding Home
├── Schedule
├── Events
├── Travel & Coaches
├── Menu
├── Music
├── Photos
├── Guests
├── Singles
├── Live Updates
└── Invitation
```

---

## 🧭 Product principles

- **Wedding-scoped by default**  
  MILNI is built around one private celebration rather than a public social graph.

- **Tradition without rigidity**  
  Sikh, Hindu, Muslim, mixed and custom celebrations should all be able to use the same platform without being forced into one template.

- **Useful for every guest**  
  MILNI should help the cousin who knows every ceremony just as much as the guest attending an Indian wedding for the first time.

- **Mobile first, not mobile only**  
  Guests will mostly use phones. Organisers may prefer desktop. Both should feel intentional.

- **Privacy is part of the product**  
  Invitations, guest data, Singles activity, conversations and wedding updates are scoped to the people who belong there.

- **Less group-chat archaeology**  
  Important information should be easy to find without scrolling through hundreds of messages.

---

## 🛠️ Current status

MILNI is in **active development** and is already deployed for real-device testing.

Recent milestones include:

- [x] Responsive organiser and guest journeys
- [x] Wedding schedules and event editing
- [x] Event-level invitations and RSVP
- [x] Guest management
- [x] Live announcements
- [x] Home-page announcements integration
- [x] Photos and event albums
- [x] Wedding hero image uploads
- [x] MILNI Singles matching and chat
- [x] In-app notification centre
- [x] Web Push on mobile and desktop
- [x] PWA manifest and service worker
- [ ] Scheduled event reminders
- [ ] Coach / transport departure reminders
- [ ] Per-notification preferences
- [ ] Continued UX, accessibility and performance polish

---

## ❤️ Why MILNI?

Indian weddings are not one event.

They are several days of ceremonies, families, food, travel, outfits, music, traditions, logistics, photos, last-minute changes and people trying to work out where the coach has gone.

MILNI is an attempt to give all of that beautiful chaos a home.
