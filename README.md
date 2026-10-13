# Hilo

Hilo is an app for older people who live alone. Every day it asks them how they are, reminds them about their pills and asks them one question about their life. Over time, their answers become a book of their life for the family.

> Status: in development. The senior screens are built with sample data, the database is set up and family login works. See [Progress](#progress).

## Why I'm building it

It started with my grandmother. She likes it when someone asks her how she is doing, but most days nobody does. And she often forgets if she has already taken her pills, so she ends up asking us or guessing.

She is not the only one. In Europe there are millions of people over 65 living alone. Many of them feel lonely, and their families live far away and worry about them. Most "senior apps" treat older people like patients. I want to build something that makes them feel listened to and valued.

## Who it's for

- **The senior** (75+), who uses the app every day. They may never have used an AI assistant before, so the app has to be very simple: a friendly sphere, big text and two or three big buttons.
- **The family** (usually sons and daughters, 45 to 60), who set up the app, get a short weekly update and keep the stories. They are the ones who pay.

## What it does

**For the senior**
- **A daily chat.** A notification at their usual time ("Good morning, Carmen. Shall we chat?"). They hold a button to talk, like a walkie-talkie. The assistant asks how they slept and how they feel.
- **Pills.** Simple reminders with big Yes / No buttons. If a pill is not confirmed, the family gets a message.
- **One question about their life.** Each day: their first job, how they met their partner, what their town was like. Telling their story is the part that makes them feel valued.
- **My book.** They can read or listen to the chapters of their own story.

**For the family**
- A short weekly summary.
- **The book of their life**: chapters written only with the senior's own words, with a play button to hear their voice. The family reviews each chapter, corrects names or dates and approves it. Then they can order a printed copy.

## Principles

- **No medical advice.** Hilo is a companion, not a doctor. If something sounds worrying, it suggests talking to their doctor and lets the family know.
- **Nothing made up.** The book only uses what the senior actually said. Gaps become new questions, not guesses.
- **Safety-critical parts are plain code, not AI.** Pill reminders and alerts never depend on what an AI understood.
- **Privacy first.** Voice and health data are sensitive. Data stays in the EU, with clear consent and the option to delete everything.
- **The microphone only listens while the button is held down.**

## Tech

- React Native + Expo (SDK 57) + TypeScript, Expo Router
- iPhone, iPad and Android from one codebase (development builds, not Expo Go)
- Supabase (EU region, Frankfurt) for data, auth and server functions
- On-device speech recognition (expo-speech-recognition), Claude Haiku for the conversation through a Supabase Edge Function, local notifications for the talk and the pills
- API keys live only on the server, never in the app

## Progress

**Done**
- Family side: sign in with a 6-digit email code, onboarding (your name, who Hilo is for, talk time, pills), pairing the senior's phone with a code or a QR, tabs Today, Book and Settings
- Senior side: the senior's own consent, Home with real data, Pills with confirm and undo, reminders for the talk and each pill (tap opens the right screen)
- The daily talk: speech recognition on the phone, Claude replies through the `talk` Edge Function, every turn saved, token usage counted per senior and day
- Database: families, people, consents, medications, doses, pairing codes, talks, turns and usage, all with Row Level Security
- Landing page with a waitlist: [hilo-web.vercel.app](https://hilo-web.vercel.app) (separate repo)

**Next**
- Hilo's voice: text to speech inside the `talk` function, voice speed per senior, a Repeat button
- The pill question back inside the talk
- Editable settings and the book with real chapters
- TestFlight and a first test with a real person
- iPad layouts

## Project structure

```
src/
  app/                 screens (Expo Router)
    index.tsx          start: decides where each user goes
    onboarding/        family onboarding
    family/            family tabs: today, book, settings
    (senior)/          senior app: home, talk, pills, book
    pair-code.tsx      senior: pair with a 6-digit code
    pair-scan.tsx      senior: pair by scanning the QR
    consent.tsx        senior: their own consent
  components/          shared UI (BigButton, Bot, ScrollFade…)
  lib/                 supabase client, onboarding, pairing, reminders, talk
  theme.ts             design tokens from the Figma
assets/icons/          SVGs exported from the Figma
supabase/migrations/   database schema, versioned in git
supabase/functions/    Edge Functions (Deno): talk
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

**Talk function:** deploy `supabase/functions/talk/index.ts` and set the `ANTHROPIC_API_KEY` secret in Supabase.

## Languages

Spanish and English first. Dutch next.

---

Built by [Arnau López](https://arnau-lopez.com).
