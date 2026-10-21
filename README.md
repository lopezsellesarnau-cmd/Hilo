# Hilo

Hilo is an app for older people who live alone. Every day it asks them how they are, reminds them about their pills and asks them one question about their life. Over time, their answers become a book of their life for the family. And it brings the family closer: it tells them when nobody has called in a while, and gives them something to talk about.

> Status: in development. The daily talk works end to end with voice, the pills are asked inside the talk, and each talk becomes a story the family reviews for the book. The whole family can join with a code, and the family side also runs in the browser: [hilo-app-beta.vercel.app](https://hilo-app-beta.vercel.app). It is on TestFlight (iPhone and iPad). Next: a first test with a real person. See [Progress](#progress).

## Why I'm building it

It started with my grandmother. She likes it when someone asks her how she is doing, but most days nobody does. And she often forgets if she has already taken her pills, so she ends up asking us or guessing.

She is not the only one. In Europe there are millions of people over 65 living alone. Many of them feel lonely, and their families live far away and worry about them. Most "senior apps" treat older people like patients. I want to build something that makes them feel listened to and valued. An AI should not replace the grandchildren, so Hilo keeps pointing back to them.

## Who it's for

- **The senior** (75+), who uses the app every day on an iPhone or iPad. They may never have used an AI assistant before, so the app has to be very simple: a friendly bot, big text and two or three big buttons.
- **The family** (sons, daughters and grandchildren), who set up the app, follow how her day goes and keep the stories. They use the iPhone app or the web app (so relatives with Android can join too). They are the ones who pay.

## What it does

**For the senior**
- **A daily chat.** A notification at their usual time ("Good morning, Carmen. Shall we chat?"). They tap once and talk; Hilo answers out loud when they pause. It asks how they slept and how they feel. If Hilo talks too fast, they can say "habla más despacio".
- **It remembers.** After each talk Hilo keeps a few short notes (people, places, plans) and asks about them the next day. It also knows the weather and the public holidays in their town.
- **Pills.** Simple reminders with big buttons. Inside the talk, Hilo asks about any pill that is due and they answer Yes or No.
- **One question about their life.** Each day: their first job, how they met their partner, what their town was like. Telling their story is the part that makes them feel valued.
- **My book.** They can read the stories of their own life once the family approves them, or tap "Listen to my story" and Hilo reads it aloud.

**For the family**
- **Today:** how her day is going at a glance (today's talk, the last 7 days, her pills) and only what needs doing.
- **Talks:** today's talk, the history with the story each one became, and a "What to talk about with her" line after each talk ("She told Hilo she went to the fair: ask her how it went"). Never the transcript word for word.
- **Calls:** "I talked to her today", or she tells Hilo. After 3 days without anyone in the family talking to her, one family member gets a nudge.
- **The book of their life:** one story from each talk, written only with the senior's own words. The family reviews each story (words the senior never said are marked) and approves or discards it.
- **The whole family:** invite siblings and grandchildren with an 8-digit code or a QR (Familia plan).
- **Alerts:** a push when she hasn't talked to Hilo in 2 days.

## Principles

- **No medical advice.** Hilo is a companion, not a doctor. If something sounds worrying, it suggests talking to their doctor and lets the family know.
- **Nothing made up.** The book only uses what the senior actually said. The quote must appear word for word in what they said, and the code marks any word of the story they never used. Nothing reaches their book without the family's approval.
- **What's hers stays hers.** The family never reads the talks word for word. If she tells Hilo something is just for Hilo, it stays out of the family's line, the notes and the book.
- **Safety-critical parts are plain code, not AI.** Pill reminders and alerts never depend on what an AI understood.
- **Privacy first.** Voice and health data are sensitive. Data stays in the EU, with clear consent and the option to delete everything. Recordings of deleted stories and abandoned anonymous accounts are cleaned up automatically.
- **The microphone only listens after a tap**, and stops on a pause, on "He terminado" or after two minutes.

## Tech

- React Native + Expo (SDK 57) + TypeScript, Expo Router
- iPhone and iPad (development builds, not Expo Go); the family side also as a web app (Expo web, single-page build on Vercel)
- Supabase (EU region, Frankfurt) for data, auth and server functions
- On-device speech recognition (expo-speech-recognition), so the senior's voice stays on the phone
- Edge Functions (Deno):
  - `talk`: Claude Haiku 5.5 for the conversation (prompt caching, small tools for the voice speed and to end the talk), Azure Speech for Hilo's voice (ElevenLabs can be switched in with a secret), Claude Sonnet 5.5 to write each story and the short notes in the background, weather (MET Norway) and holidays (Nager.Date)
  - `quiet-alert`: hourly cron, pushes to the family's phones straight to Apple (APNs) when she hasn't talked in 2 days or nobody has called in 3
  - `revenuecat-webhook`: saves each family's plan in Supabase
  - `privacy-cleanup`: deletes recordings of deleted stories and orphaned anonymous accounts
- Subscriptions with RevenueCat: App Store on iPhone, RevenueCat Web Billing (Stripe) on the web. The RevenueCat user is the family, so a plan bought anywhere works everywhere
- API keys live only on the server, never in the app. Every senior's daily cost (tokens and voice characters) is counted in a `usage` table

## Progress

**Done**
- Family side: sign in with a 6-digit email code, onboarding (your name, who Hilo is for, talk time, pills), pairing the senior's phone with a code or a QR, a first-day checklist
- Family tabs: Today, Talks, Book and Settings, with badges for stories to review and a call that is due, and pull to refresh
- Invite the family: an 8-digit code or a QR, valid for 7 days, for the Familia plan
- Calls and "What to talk about with her", and the 3-day nudge
- Senior side: the senior's own consent, Home with real data, Pills with confirm and undo, reminders for the talk and each pill (tap opens the right screen)
- The daily talk: speech recognition on the phone, Claude replies through the `talk` Edge Function, every turn saved, cost counted per senior and day, a daily limit checked on the server
- Hilo's voice: Azure Speech inside `talk` (text and audio come back in one trip), plays on the loudspeaker even when the iPhone is on silent, a Repeat button that costs nothing, the speed saved per senior and changed by voice
- Memory between talks, which the family can read and correct in Settings
- The book: one story per talk in the senior's words, family review, My book for the senior, and her stories read aloud
- Subscriptions: two plans (Básico and Familia), 14-day trial, on iPhone and on the web
- The family web app: same screens, the iPad layout on a computer and the phone layout in a mobile browser
- Spanish, English and Dutch
- iPad: the same screens centred upright, and two halves on its side. iPhone stays portrait
- TestFlight builds for iPhone and iPad
- Landing page with a waitlist: [hilo-web.vercel.app](https://hilo-web.vercel.app) (separate repo)

**Next**
- A first test with a real person
- Claude through an EU region (Bedrock) before real families
- Alerts by email for the family on the web
- Signals, not emergencies (pills missed 2 days, a "Call my son" button on her Home)
- German
- Android app

## Project structure

```
src/
  app/                 screens (Expo Router)
    index.tsx          start: decides where each user goes
    onboarding/        family onboarding (and joining a family with a code)
    family/            family tabs: today, talks, book, settings
    review/            family: review one story before it goes to the book
    invite.tsx         family: invite the family (code, QR, who's in)
    memory.tsx         family: what Hilo remembers, to read and correct
    paywall.tsx        family: the two plans
    (senior)/          senior app: home, talk, pills, book
    pair-code.tsx      senior: pair with a 6-digit code
    pair-scan.tsx      senior: pair by scanning the QR
    consent.tsx        senior: their own consent
  components/          shared UI (BigButton, Bot, ListRow, DayDot, WeekStrip, WideSplit…)
  lib/                 supabase client, onboarding, pairing, invites, calls, purchases, reminders, push, talk, layout
  i18n/                Spanish, English and Dutch
  theme.ts             design tokens
supabase/migrations/   database schema, versioned in git
supabase/functions/    Edge Functions (Deno): talk, quiet-alert, revenuecat-webhook, privacy-cleanup
vercel.json            the family web app on Vercel
```

## Run it locally

```bash
npm install
cp .env.example .env   # Supabase URL and anon key, RevenueCat public keys (iOS and Web Billing)
npx expo prebuild -p ios
npx expo run:ios --device   # development build on a plugged-in iPhone
```

After the first build, `npx expo start` is enough. Rebuild only when a native library changes. Speech recognition and notifications need the development build, not Expo Go.

**Web app (family side):**

```bash
npx expo start --web          # in the browser while developing
npx expo export -p web        # the build Vercel runs (output in dist/)
```

On Vercel the `EXPO_PUBLIC_*` variables must be of type Config, not Secret, and a change needs a redeploy. Use the RevenueCat sandbox key (`rcb_sb_`) and Stripe's test cards while testing.

**Database:** migrations live in `supabase/migrations/`. To apply them to your project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

For the email code to arrive, the Magic Link email template in Supabase must include `{{ .Token }}`.

**Edge Functions:** deploy the four functions in `supabase/functions/` and set their secrets in Supabase (Edge Functions → Secrets). The list is in `supabase/functions/.env.example`: Anthropic, Azure Speech (or ElevenLabs), the cron secret, the APNs key and the RevenueCat webhook and secret keys. `quiet-alert` and `privacy-cleanup` run on Supabase Cron.

## Languages

Spanish, English and Dutch. German next.

---

Built by [Arnau López](https://arnau-lopez.com).
