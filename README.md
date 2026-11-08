# Secret Santa / Amigo Secreto

A minimal, mobile-first Secret Santa gift exchange for families. One moderator creates an exchange, adds names, optionally sets exclusions, runs a fair draw, then shares a **private link per person**. Each participant only learns who they gift — the full assignment map stays secret.

English is the default. Spanish is fully supported. The app picks the device language (`navigator.language`) with English fallback, and includes an in-app language toggle.

## What it does

1. **Moderator** creates an exchange with a short PIN (4–8 digits).
2. Adds **participant names**.
3. Optionally sets **exclusions** (person A must not draw person B).
4. Runs a **fair draw** that respects exclusions. If the exclusions make a valid draw impossible, the app says so clearly.
5. Shares a **unique private link/code** with each person. Opening that link reveals only their assignee.

No accounts beyond the moderator PIN. No wishlists. Data is stored on the server (Netlify Blobs in production, local `.data/` when you run `npm start`), so relatives in different countries can use the same public URL.

## Local demo

```bash
cd secret-santa
npm install
npm start
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787).

Optional Netlify CLI local emulation (uses Functions + Blobs when linked):

```bash
npx netlify login
npx netlify link   # or create a new site
npm run netlify:dev
```

## How to use

### Moderator

1. Open the site → **Start an exchange** / **Crear un intercambio**.
2. Enter a name and a PIN. Remember the PIN — it unlocks moderator controls.
3. Add everyone who is exchanging gifts.
4. (Optional) Add exclusions for couples, roommates, etc.
5. Tap **Draw names** / **Sortear nombres**.
6. Copy each person’s private link and send it privately (text, email, chat).

True secrecy: after the draw, the moderator can share links but **cannot** see who drew whom.

### Participants

1. Open the private link (or paste the code on the home screen).
2. If the draw is done, you see only the person you gift.
3. If not drawn yet, you’ll see a waiting message — refresh later.

### Languages

- Auto-detects Spanish vs English from the browser.
- Toggle anytime with the language button in the top bar.
- Preference is remembered in `localStorage` (`ss-lang`).

## Deploy to Netlify (your account)

This project is ready for **your** Netlify account. Agents cannot log into Netlify for you. There is **no live shareable Netlify URL** until you finish one of the account-link steps below.

Build settings are already in `netlify.toml`:

| Setting | Value |
| --- | --- |
| Build command | `npm install --omit=dev` |
| Publish directory | `public` |
| Functions directory | `netlify/functions` |

### What you must do (pick one)

#### 1) Recommended — Deploy from Git (Netlify UI)

Exact connect steps:

1. **Get the code on GitHub** under your account (repo URL from the agent handoff if one was pushed, otherwise create a new empty repo and push `/agent/secret-santa`).
2. Sign in at [https://app.netlify.com](https://app.netlify.com) with **your** Netlify account.
3. Click **Add new site** → **Import an existing project**.
4. Choose **GitHub**, authorize Netlify if asked, then select the Secret Santa repo.
5. Leave build settings as detected from `netlify.toml` (`npm install --omit=dev`, publish `public`, functions `netlify/functions`).
6. Click **Deploy site**.
7. When the deploy is live, open the site’s `*.netlify.app` URL and share that link with family.

No Netlify access token is required for this path — only your Netlify + GitHub login in the browser.

#### 2) Netlify CLI with a personal access token

If you prefer CLI from this (or any) machine:

1. In Netlify: **User settings → Applications → Personal access tokens → New access token**.
2. Provide that token to the agent as a Cursor secret (e.g. `NETLIFY_AUTH_TOKEN`), **or** run locally:

```bash
export NETLIFY_AUTH_TOKEN=your_token_here
npm install
npx netlify sites:create --name your-secret-santa-name
npx netlify link
npx netlify deploy --prod
```

Without that token (or an interactive `netlify login` in your own terminal), the agent cannot create a site on your account.

### Redirects / API

`netlify.toml` maps `/api/*` → `/.netlify/functions/api/:splat`, so the frontend always calls `/api/...`.

### Secrets / environment variables

**None required** for a basic deploy. Moderator PINs are hashed with bcrypt before storage. Assignment maps are stored server-side and never returned to browsers (participants only get their own assignee via their private code).

Netlify Blobs work automatically on a linked site via `getStore({ name: "secret-santa" })` — no Blob env vars needed for the default store.

## Project layout

```
public/                 # static frontend
  index.html
  css/styles.css
  js/app.js
  js/i18n.js
netlify/
  functions/api.js      # REST API
  lib/                  # draw, auth, store, ids
server.mjs              # local file-backed demo server
netlify.toml
```

## License

MIT
