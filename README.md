<div align="center">
  <img src="public/icons/icon-192x192.png" width="96" alt="Expense Tracker AI icon" />
  <h1>Expense Tracker AI</h1>
  <p>A modern, AI-powered expense tracker built with Angular 22 and Google Sheets as a backend.</p>

  ![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular)
  ![Material](https://img.shields.io/badge/Material_3-22-1565C0?logo=angular)
  ![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8?logo=pwa)
  ![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20FR%20%7C%20AR-orange)
  ![version](https://img.shields.io/badge/version-0.1.0-blue)
  ![CI](https://github.com/beligh-hamdi/expense-tracker/actions/workflows/deploy.yml/badge.svg)
  ![License](https://img.shields.io/badge/license-MIT-green)
</div>

---

## Live Demo

**[https://beligh-hamdi.github.io/expense-tracker/](https://beligh-hamdi.github.io/expense-tracker/)**

---

## Features

| Feature | Details |
|---|---|
| **Dashboard** | Monthly totals, top category, budget progress, horizontal category bar chart, daily spending line chart, and monthly bar chart — all themed with Material 3 tokens |
| **Expenses** | Add, edit, delete expenses with category, amount, date, and description |
| **AI receipt scanning** | Upload or snap a receipt — Gemini Vision extracts merchant, amount, and date automatically. Falls back to Tesseract.js (offline OCR) if no API key is configured |
| **Receipt zoom** | Click a receipt thumbnail to open a full-screen lightbox |
| **AI insights** | Gemini 2.5 Flash analyses spending patterns and returns a structured report in the active app language (EN / FR / AR) |
| **Categories** | Create and manage custom categories with Material 3 icons, M3 theme colors, and monthly budget limits |
| **Google Sheets backend** | Data lives in your own Google Spreadsheet — no proprietary database, no vendor lock-in |
| **Google OAuth** | Sign in with Google; PKCE S256 + Web application client; `client_secret` never in the browser bundle (Cloudflare Worker proxy) |
| **PWA** | Installable on desktop and mobile; works offline; iOS home screen supported with BroadcastChannel auth handoff |
| **Dark / Light mode** | System-aware theme toggle with Material 3 color tokens |
| **Multi-language** | English, French, Arabic (RTL) — switchable at runtime, persisted in `localStorage` |
| **Auto-versioning** | Version bumped on every push to `main` via conventional commits; displayed in Settings |

---

## Tech Stack

- **[Angular 22](https://angular.dev)** — standalone components, signals, `@Service()`, `effect()`, `computed()`
- **[Angular Material 22](https://material.angular.io)** — Material Design 3 components and theming
- **[Transloco](https://jsverse.github.io/transloco/)** — runtime i18n with lazy-loaded JSON files
- **[Chart.js](https://www.chartjs.org)** — bar, line, and category charts themed with M3 color tokens
- **[Google Gemini API](https://ai.google.dev)** — AI receipt scanning (Vision) and multilingual spending insights (`gemini-2.5-flash`)
- **[Tesseract.js](https://tesseract.projectnaptha.com)** — offline OCR fallback for receipt scanning
- **[Google Sheets API v4](https://developers.google.com/sheets/api)** — data storage (`Expenses`, `Categories`, `Settings` tabs)
- **[Angular Service Worker](https://angular.dev/ecosystem/service-workers)** — PWA & offline support
- **[Cloudflare Workers](https://workers.cloudflare.com)** — serverless token proxy; keeps `client_secret` out of the browser bundle

---

## Security Model

| Credential | Where it lives | Notes |
|---|---|---|
| Google OAuth `client_id` | Bundle (public) | Identifies the app registration — not sensitive |
| Google OAuth `client_secret` | **Cloudflare Worker only** | Encrypted Cloudflare secret; never in the browser bundle, never in GitHub secrets |
| Gemini API key | User's Google Sheet (`Settings` tab) + `localStorage` | Never in the bundle or CI — each user owns and enters their own key |
| Google access token | `localStorage`, short-lived (1 h) | Cleared on logout and expiry; no refresh token stored (`access_type: online`) |

### How the token proxy works

```
Browser                          Cloudflare Worker              Google
  │                                     │                          │
  │── POST /token ─────────────────────▶│                          │
  │   { code, code_verifier,            │                          │
  │     redirect_uri }                  │                          │
  │                                     │── POST oauth2/token ────▶│
  │                                     │   + client_secret        │
  │                                     │   (server-side only)     │
  │                                     │◀── { access_token } ─────│
  │◀── { access_token } ────────────────│                          │
```

`client_secret` travels only between Cloudflare and Google — the browser never sees it.

### iOS PWA OAuth

When installed on the iOS home screen, the app runs in standalone mode with an isolated `localStorage`. A standard redirect to Google would lose the PKCE `code_verifier`. Instead:

1. The PWA sets a `et_pwa_oauth` flag in `localStorage` and opens the Google auth URL in a new Safari tab
2. Safari handles the OAuth flow; Google redirects to the callback URL
3. The callback page detects the flag, broadcasts `{ code }` back via `BroadcastChannel`, and closes itself
4. The PWA receives the code, retrieves `code_verifier` from its own `localStorage`, and completes the exchange via the Cloudflare Worker

### OAuth scope

Only `spreadsheets` is requested — the app never touches Drive files, Drive folders, Gmail, or any other Google service.

> Google does not offer a per-file or per-folder Sheets scope. `spreadsheets` is the narrowest available scope for user-provided spreadsheets.

---

## CI/CD

Every push to `main` triggers a 4-job GitHub Actions pipeline:

```
push to main
    │
    ▼
version  — reads commits since last tag; bumps by conventional commit type:
           BREAKING CHANGE / feat! → major  |  feat → minor  |  everything else → patch
           commits [skip ci] and pushes the new git tag
    │
    ▼
build    — validates required secrets (fails fast with a clear message if any are missing)
           injects version + secrets into environment files, builds Angular for production
    │
    ▼
deploy   — deploys dist/ to GitHub Pages
    │
    ▼
release  — creates a GitHub Release with commits grouped by type:
           ⚠️ Breaking  ✨ Features  🐛 Fixes  ♻️ Refactoring  ⚡ Perf  📚 Docs  🔧 Chores
```

### Required GitHub repository secrets

Go to **Settings → Secrets and variables → Actions** in your fork and add:

| Secret | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | Web application OAuth 2.0 client ID |
| `GOOGLE_REDIRECT_URI` | Yes | e.g. `https://your-username.github.io/expense-tracker/auth/callback` |
| `TOKEN_PROXY_URL` | Yes | Cloudflare Worker URL — e.g. `https://expense-tracker-token-proxy.YOUR-SUBDOMAIN.workers.dev/token` |
| `SHEET_ID` | No | Default Google Spreadsheet ID pre-filled for all users (optional) |

> `GOOGLE_CLIENT_SECRET` is **not** a GitHub secret. It lives exclusively as an encrypted Cloudflare Worker secret — set it with `wrangler secret put GOOGLE_CLIENT_SECRET` inside `worker/`.

> `AI_API_KEY` is **not** a CI secret. Each user enters their own Gemini key in **Settings → AI & Insights**; it is stored in their spreadsheet's `Settings` tab and synced to `localStorage` automatically on sign-in.

If a required secret is missing the build fails immediately with a clear message:

```
──────────────────────────────────────────────
  Missing required GitHub repository secrets:
──────────────────────────────────────────────
  ✗  TOKEN_PROXY_URL

  Go to: Settings → Secrets and variables → Actions
  and add the missing secrets listed above.
──────────────────────────────────────────────
```

---

## Getting Started

### Prerequisites

- Node.js 24+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- A Google Cloud project with:
  - **Google Sheets API** enabled
  - **OAuth consent screen** configured (External; add test user emails while in Testing mode)
  - **OAuth 2.0 credentials** — Application type: **Web application**
- A free [Gemini API key](https://aistudio.google.com/app/apikey) — entered inside the app, never in code

> The **Google Drive API does not need to be enabled** — the app only calls the Sheets API.

### 1. Clone and install

```bash
git clone https://github.com/beligh-hamdi/expense-tracker.git
cd expense-tracker
npm install
```

### 2. Create OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Add **Authorized JavaScript origins**:
   - `http://localhost:4200`
   - `https://your-username.github.io`
5. Add **Authorized redirect URIs**:
   - `http://localhost:4200/auth/callback`
   - `https://your-username.github.io/expense-tracker/auth/callback`
6. Copy the **Client ID** and **Client secret**

### 3. Deploy the Cloudflare Worker (token proxy)

The worker keeps `client_secret` server-side. Do this once before running locally or deploying to production.

```bash
cd worker
npm install
npx wrangler login        # opens Cloudflare in your browser
```

Store secrets (Cloudflare encrypts these — they never appear in code or logs):

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Deploy:

```bash
npx wrangler deploy
```

Cloudflare prints your worker URL:

```
https://expense-tracker-token-proxy.YOUR-SUBDOMAIN.workers.dev
```

Save this URL — you need it as `TOKEN_PROXY_URL` in both the local environment and GitHub secrets.

### 4. Configure the local environment

Create `src/environments/environment.ts` (gitignored — never committed):

```ts
export const environment = {
  production: false,
  version: '0.0.0-dev',
  google: {
    clientId:      'YOUR_CLIENT_ID.apps.googleusercontent.com',
    // Option A: run `npx wrangler dev` in worker/ — uses the proxy on :8787
    tokenProxyUrl: 'http://localhost:8787/token',
    // Option B: set clientSecret to skip wrangler dev and call Google directly
    // clientSecret: 'YOUR_CLIENT_SECRET',
    redirectUri:   'http://localhost:4200/auth/callback',
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'profile',
      'email',
    ].join(' '),
  },
  sheetsApi: {
    baseUrl:        'https://sheets.googleapis.com/v4/spreadsheets',
    defaultSheetId: '',
  },
  // Gemini API key is entered by each user in Settings → AI & Insights
};
```

**Option A** — use the worker locally (mirrors production):
```bash
cd worker && npx wrangler dev   # starts on http://localhost:8787
```

**Option B** — skip the worker, call Google directly (simpler for dev):  
Uncomment `clientSecret` in `environment.ts` and fill in your secret. No extra process needed.

### 5. Run the dev server

```bash
ng serve
```

Open `http://localhost:4200`.

### 6. First-run setup in the app

1. **Sign in with Google.**
2. Go to **Settings → Google Sheet** — paste your Google Spreadsheet ID and click **Connect & Set Up**.
   The app creates `Expenses`, `Categories`, and `Settings` tabs and seeds default categories automatically.
3. Go to **Settings → AI & Insights** — paste your Gemini API key and click **Save Key**.
   It is stored in the `Settings` tab of your spreadsheet and synced to `localStorage` on every future sign-in (including on new devices).

---

## Building for Production

```bash
ng build --configuration production --base-href /expense-tracker/
```

Output is in `dist/expense-tracker-ai/browser/`.

---

## Project Structure

```
worker/
├── index.js          # Cloudflare Worker — token proxy (keeps client_secret server-side)
├── wrangler.toml     # Worker name + compatibility date
└── package.json      # wrangler dev / deploy scripts
src/
├── app/
│   ├── core/
│   │   ├── auth/           # Google OAuth (PKCE), BroadcastChannel iOS handoff,
│   │   │                   # token interceptor, auth guard
│   │   ├── google-sheets/  # Sheets API CRUD, SheetConfigService (spreadsheet ID + AI key sync)
│   │   ├── i18n/           # LanguageService — RTL support, category name translation
│   │   ├── ocr/            # OcrService — Gemini Vision + Tesseract.js fallback
│   │   ├── pwa/            # PwaService — install prompt + update banner
│   │   └── theme/          # ThemeService — light/dark toggle
│   ├── features/
│   │   ├── auth/           # Login page
│   │   ├── categories/     # CategoriesService + list/form dialog
│   │   ├── dashboard/      # DashboardService + Chart.js charts
│   │   ├── expenses/       # ExpensesService + table/form dialog + receipt scanning
│   │   ├── insights/       # InsightsService — multilingual Gemini prompt + markdown render
│   │   └── settings/       # SettingsService + spreadsheet / AI key / language / about cards
│   ├── layout/
│   │   └── shell/          # App shell — sidenav, toolbar, language switcher, AI key sync
│   └── shared/
│       ├── components/     # Chart wrapper, ConfirmDialog
│       ├── models/         # Expense, Category interfaces + Sheets row mappers
│       └── utils/          # crypto (UUID), M3 color token resolver
├── environments/           # environment.ts (local, gitignored) + environment.prod.ts (CI-generated)
└── styles.css              # Global styles + RTL overrides
public/
├── i18n/                   # en.json, fr.json, ar.json
├── icons/                  # PWA icons (72 → 512 px)
├── icon-source.svg         # Master icon SVG
└── manifest.webmanifest
```

### Architecture pattern

Every feature follows the same shape:

```
feature/
├── feature.ts          # Thin component — injects service, handles dialogs/events
├── feature.html        # Template reads only from svc.*
├── feature.service.ts  # Owns all state + business logic + API calls
│                         private signal() → exposed via .asReadonly()
└── sub-components/     # Pure presentational components
```

State is managed with Angular signals: private writable `signal()` fields mutated only inside the service, exposed publicly as `.asReadonly()` to prevent external mutation.

---

## Internationalization

The app supports three languages switchable at runtime from the toolbar:

| Language | Code | Direction |
|---|---|---|
| English | `en` | LTR |
| Français | `fr` | LTR |
| العربية | `ar` | RTL |

LTR ↔ RTL switches trigger a full page reload so Angular Material's CDK `Directionality` re-initialises correctly. Same-direction switches (EN ↔ FR) hot-swap without a reload.

The OCR receipt scanner automatically selects the matching Tesseract language model (`eng` / `fra` / `ara`) based on the active app language. AI insights are also generated in the active language — the Gemini prompt includes an explicit language instruction.

---

## License

MIT
