# MILNI push notifications

MILNI uses standard Web Push with VAPID. There is no Firebase, email provider, WhatsApp provider, or per-notification service fee.

## One-time VAPID setup

Generate a key pair locally:

```bash
node scripts/generate-vapid.mjs
```

Store the generated values in the same Cloudflare Worker environment that already holds the MILNI D1/session secrets:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

For `VAPID_SUBJECT`, use a contact URI you control, for example the public MILNI site URL (`https://your-milni-domain.example`) or a `mailto:` address.

Keep `VAPID_PRIVATE_KEY` private. The public key is intentionally returned to signed-in wedding guests by `/api/push/public-key` so their browser can create a subscription.

## Current notification triggers

- Organiser Live announcements, including urgent updates, notify all subscribed guests in that wedding.
- A new Singles match notifies the other matched guest.
- A new Singles chat message notifies only the other person in that match.
- Every notification is also stored in MILNI's in-app notification centre.
- Push notification taps deep-link to the relevant Live page or Singles conversation.

## iPhone and iPad

Web Push is offered after the guest adds MILNI to the Home Screen. MILNI detects iOS browser mode and explains the Home Screen step instead of displaying a dead-end permission prompt.

## Local checks

```bash
npm run typecheck
npm run build
```

Push delivery itself must be tested over HTTPS on the deployed site. Use two guest accounts/devices for Singles testing so the recipient has a real push subscription.
