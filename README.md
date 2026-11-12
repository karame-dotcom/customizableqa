# CS Coach 🇵🇭

A study coach for the **Civil Service Exam (Professional level)**. It runs in any browser, on desktop or phone, and can be packaged as an Android APK or an iOS app.

## Features
- Four tabs:
  - **Learn**: 25 original step-by-step lessons (intro → one key point per step → example → quick check → practice), ordered by exam importance (🔥 high-yield / ⭐ important / 📘 good to know), with a "Watch video lessons" link (YouTube search sorted by views)
  - **Practice**: subject rounds, Full Mock Exam, Mistakes & Starred, ✨ AI-generated questions
  - **Calendar**: exam countdown, prep-day progress, daily goal, month heatmap of questions answered per day
  - **Analytics**: stat tiles, accuracy-by-subject chart, score trend, weakest topics, table view, "Practice mistakes & starred" button
- Question rotation: an answered question doesn't come back for 30 days (except in Mistakes & Starred)
- AI-generated questions (claude.ai artifact version): fresh questions on your weakest topic, validated and saved to the device
- Interface language: **English, Tagalog or Taglish** (chosen at setup; also applies to Kiko and the AI coach). Questions stay in their exam language, as in the real CSC exam
- First-run setup: your name and Exam mode (answers revealed after submitting) or Practice mode (instant feedback); change anytime in Settings
- Tap a subject to jump straight into a 10-question round (new and missed questions first), or take a **Full Mock Exam**. 200+ questions in total
- One-line question overview, arrow buttons (plus swipe and keyboard arrows) for Previous/Next, a "Not sure" tick mark, and a ⭐ star to come back to questions
- "Help me" coach on every question: hints on how to approach it without giving the answer
- Results screen with an 80% passing mark and a **review of every question**, filterable by correct, wrong, unanswered, not sure and starred
- "Retry wrong" mode to drill your mistakes
- Per-subject analytics (accuracy and progress) saved on the device
- **AI Coach** floating chat: analyzes your stats, finds weak subjects, and builds a daily study plan around your exam date. Uses Claude when the page runs as a claude.ai artifact; otherwise a built-in coach answers from your local analytics
- **Kiko**, an animated study buddy that wanders, cheers when you get it right and cries with you when you miss (in Exam mode it reacts to your final score so answers stay hidden)
- **Report a problem** (Settings → 🐞): testers pick a type (wrong answer, bug, suggestion, other) and describe it; their email app opens with the report addressed to sharematerials2026@gmail.com, including the app version and phone type
- Green, blue and white theme; works on phones and can be installed as an app (PWA)

> The CSC does not publish actual exam questions. The bank in `www/questions.js` contains practice items modeled on the official exam coverage. Add more by following the same format: `{ q, c: [choices], a: correctIndex, e: explanation, h: coaching hint }`.

## Lessons follow the official CSC scope
Lessons are organized by the official CSC Professional exam scope of examination:
- **General Information:** Philippine Constitution · R.A. 6713 · Peace and Human Rights · Environment Management and Protection
- **Verbal Ability (English and Filipino):** Word meaning · Sentence completion · Error recognition · Sentence structure · Paragraph organization · Reading comprehension
- **Analytical Ability:** Word analogy · Symbolic logic/abstract reasoning · Identifying assumptions and drawing conclusions · Data interpretation
- **Numerical Ability:** Basic operations · Number sequence · Word problems

## Your data is safe across updates
- Progress is stored on the device (`localStorage`, keys `cscoach.*`). App updates never clear it.
- A full backup is saved automatically before a new app version first runs, and once a day (last 5 kept).
- Questions are fingerprinted by their text, so progress follows a question even if the bank is reorganized.
- Settings → **Backup & restore**: download a backup file, or restore from a file.
- **Rules for developers:** only *append* new questions to a subject's list (never reorder or delete), and never rename lesson `id`s.

## Website (phones: iPhone & Android)
`.github/workflows/pages.yml` publishes `www/` to GitHub Pages on every push.
One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site will be at `https://karame-dotcom.github.io/CS-Coach/`.
On a phone, open the link and **Add to Home Screen** (iPhone: Share → Add to Home Screen; Android: ⋮ → Install app). It works offline too.

## AI tutor: bring your own key
Each user can connect AI in **Settings → ✨ AI tutor** with their own key:
- **Google Gemini** (free tier, key from https://aistudio.google.com/app/apikey): the app picks the newest Gemini Flash model automatically.
- **Claude** (paid per use, key from the Anthropic Console): Claude Opus 5.5 or Claude Haiku 5.5.

The key is stored only on that device (not in backups) and is sent only to the chosen provider. Inside claude.ai, AI is built in and no key is needed.

## AI on the website via a shared server (optional)
Inside claude.ai the app uses Claude directly. For the public website, deploy the small proxy in `server/` (Cloudflare Worker) so your Anthropic API key stays secret:
```bash
cd server
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```
Then put the Worker URL in `www/config.js` (`window.CS_AI_ENDPOINT = "https://…workers.dev"`) and push. Only the website's address may call the Worker (see `ALLOWED_ORIGINS` in `server/worker.js`). Each AI request is billed to your Anthropic account.

## Run the web version
```bash
npm start        # serves www/ at http://localhost:3000
```
Or open `www/index.html` directly. Any static host works (GitHub Pages, Netlify, Vercel): publish the `www/` folder.

On a phone, open the site and choose **Add to Home Screen** to install it like an app.

## Build the Android APK
Requires Node 18+, Android Studio and a JDK.
```bash
npm install
npm run android  # opens Android Studio → Build → Build APK(s)
```

## Build the iOS app
Requires a Mac with Xcode and CocoaPods.
```bash
npm install
npm run ios      # opens Xcode → choose a device → Run / Archive
```

After editing anything in `www/`, run `npm run cap:sync` to copy the changes into the native projects.

## Accounts & cloud sync (Firebase) — one-time setup

Without these steps the app works exactly as before (no sign-in popup is shown).

1. Go to <https://console.firebase.google.com> → **Add project** (any name; Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method**: enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorized domains**: add your site's domain (e.g. `<your-name>.github.io`). `localhost` is there by default.
4. **Build → Firestore Database → Create database** (production mode, pick a nearby region).
5. Firestore → **Rules** tab: paste the contents of `firestore.rules` and **Publish**. This makes each user able to read/write only their own data.
6. **Project settings (⚙️) → Your apps → `</>` Web** → register the app, then copy the `firebaseConfig` values (`apiKey`, `authDomain`, `projectId`, `appId`) into `window.CS_FIREBASE` in `www/config.js`. These values are public identifiers, not secrets.
7. Commit and deploy. Existing users will see the "Save your progress with an account" popup on every visit until they create an account.

How data is protected: local progress is never deleted. Creating an account uploads it; logging in on another device merges the cloud copy with what is on that device (best scores = highest, stars/lessons = union, history = union). A backup is saved on the device before any merge. Signing out keeps data on the device.
