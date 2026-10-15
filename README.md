# Hilo

Hilo is an app for older people who live alone. Every day it asks them how they are, reminds them about their pills and asks them one question about their life. Over time, their answers become a book of their life for the family.

> Status: in development. The daily talk works end to end with voice, the pills are asked inside the talk, and each talk becomes a story the family reviews for the book. It is on TestFlight (iPhone and iPad). Next: a first test with a real person. See [Progress](#progress).

## Why I'm building it

It started with my grandmother. She likes it when someone asks her how she is doing, but most days nobody does. And she often forgets if she has already taken her pills, so she ends up asking us or guessing.

She is not the only one. In Europe there are millions of people over 65 living alone. Many of them feel lonely, and their families live far away and worry about them. Most "senior apps" treat older people like patients. I want to build something that makes them feel listened to and valued.

## Who it's for

- **The senior** (75+), who uses the app every day. They may never have used an AI assistant before, so the app has to be very simple: a friendly sphere, big text and two or three big buttons.
- **The family** (usually sons and daughters, 45 to 60), who set up the app, get a short weekly update and keep the stories. They are the ones who pay.

## What it does

**For the senior**
- **A daily chat.** A notification at their usual time ("Good morning, Carmen. Shall we chat?"). They tap once and talk; Hilo answers out loud when they pause. The assistant asks how they slept and how they feel. If Hilo talks too fast, they can say "habla más despacio".
- **Pills.** Simple reminders with big buttons. Inside the talk, Hilo asks about any pill that is due and they answer Yes or No. If a pill is not confirmed, the family gets a message.
- **One question about their life.** Each day: their first job, how they met their partner, what their town was like. Telling their story is the part that makes them feel valued.
- **My book.** They can read the stories of their own life once the family approves them.

**For the family**
- A short weekly summary.
- **The book of their life**: one story from each talk, written only with the senior's own words. The family reviews each story (words the senior never said are marked) and approves or discards it. Later: a play button to hear the senior's own voice, and a printed copy.

## Principles

- **No medical advice.** Hilo is a companion, not a doctor. If something sounds worrying, it suggests talking to their doctor and lets the family know.
- **Nothing made up.** The book only uses what the senior actually said. The quote must appear word for word in what they said, and the code marks any word of the story they never used. Nothing reaches their book without the family's approval.
- **Safety-critical parts are plain code, not AI.** Pill reminders and alerts never depend on what an AI understood.
- **Privacy first.** Voice and health data are sensitive. Data stays in the EU, with clear consent and the option to delete everything.
- **The microphone only listens after a tap**, and stops on a pause, on "He terminado" or after two minutes.

## Tech

- React Native + Expo (SDK 57) + TypeScript, Expo Router
- iPhone, iPad and Android from one codebase (development builds, not Expo Go)
- Supabase (EU region, Frankfurt) for data, auth and server functions
- On-device speech recognition (expo-speech-recognition), so the senior's voice stays on the phone
- The `talk` Supabase Edge Function: Claude Haiku 5.5 for the conversation (prompt caching, two small tools to change the voice speed and to end the talk), Azure Speech for Hilo's voice (a Spain Spanish voice; ElevenLabs can be switched in with a secret), and Claude Sonnet 5.5 to write each story for the book in the background
- expo-audio to play Hilo's voice, local notifications for the talk and the pills
- API keys live only on the server, never in the app. Every senior's daily cost (tokens and voice characters) is counted in a `usage` table

## Progress

**Done**
- Family side: sign in with a 6-digit email code, onboarding (your name, who Hilo is for, talk time, pills), pairing the senior's phone with a code or a QR, tabs Today, Book and Settings
- Senior side: the senior's own consent, Home with real data, Pills with confirm and undo, reminders for the talk and each pill (tap opens the right screen)
- The daily talk: speech recognition on the phone, Claude replies through the `talk` Edge Function, every turn saved, cost counted per senior and day
- Hilo's voice: Azure Speech inside `talk` (text and audio come back in one trip), plays on the loudspeaker even when the iPhone is on silent, a Repeat button that costs nothing, the speed saved per senior and changed by voice
- Tap to talk: the turn ends after a pause of 3.5 seconds, on "He terminado" or after two minutes. Holding a button was tiring and cut people off
- The pill question inside the talk: plain code, not AI. Yes marks the pill as taken from the talk
- The talk closes on Hilo's goodbye, at the turn limit or when the senior leaves the screen (`ended_at`)
- The book: one story per talk written in the senior's words, the family reviews it with the doubtful words marked and approves or discards it, the senior reads the approved ones in My book
- Family Settings: change the talk time and language, the pills, and connect a new phone for the senior
- Database: families, people, consents, medications, doses, pairing codes, talks, turns, usage and chapters, all with Row Level Security
- Family Today tab: today's talk and the new story, which can be shared with the family
- A daily limit of talks per senior, checked on the server before a new talk starts
- iPad: the same screens centred upright, and two halves on its side (the bot, or her book, on the left and the content on the right). iPhone stays portrait
- TestFlight builds for iPhone and iPad
- Landing page with a waitlist: [hilo-web.vercel.app](https://hilo-web.vercel.app) (separate repo)

**Next**
- A first test with a real person
- Claude through an EU region (Bedrock) before real families
- Subscriptions (two plans)
- My book with the senior's own voice (their recorded answers, with consent)
- English version, then Dutch
- Android

## Project structure

```
src/
  app/                 screens (Expo Router)
    index.tsx          start: decides where each user goes
    onboarding/        family onboarding
    family/            family tabs: today, book, settings
    review/            family: review one story before it goes to the book
    (senior)/          senior app: home, talk, pills, book
    pair-code.tsx      senior: pair with a 6-digit code
    pair-scan.tsx      senior: pair by scanning the QR
    consent.tsx        senior: their own consent
  components/          shared UI (BigButton, Bot, ScrollFade, WideSplit for iPad landscape…)
  lib/                 supabase client, onboarding, pairing, reminders, talk, book, layout
  theme.ts             design tokens from the Figma
assets/icons/          SVGs exported from the Figma
supabase/migrations/   database schema, versioned in git
supabase/functions/    Edge Functions (Deno): talk (conversation, voice, pills, book)
```

## Run it locally

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npx expo prebuild -p ios
npx expo run:ios --device   # development build on a plugged-in iPhone
```

After the first build, `npx expo start` is enough. Rebuild only when a native library changes. Speech recognition and notifications need the development build, not Expo Go.

**Database:** migrations live in `supabase/migrations/`. To apply them to your project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

For the email code to arrive, the Magic Link email template in Supabase must include `{{ .Token }}`.

**Talk function:** deploy `supabase/functions/talk/index.ts` and set its secrets in Supabase (Edge Functions → Secrets). The list is in `supabase/functions/.env.example`: the Anthropic key and the Azure Speech key and region.

## Languages

Spanish and English first. Dutch next.

---

Built by [Arnau López](https://arnau-lopez.com).
