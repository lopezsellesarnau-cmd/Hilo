# Hilo

Hilo is an app for older people who live alone. Every day it asks them how they are, reminds them about their pills and asks them one question about their life. Over time, their answers become a book of their life for the family.

> Status: in development. The UX/UI v1 is designed. This repo is the first build.

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
- Supabase (EU region) for data, auth and server functions
- On-device speech recognition, ElevenLabs for the voice, an LLM through the server for the conversation
- API keys live only on the server, never in the app

## Run it locally

```bash
npm install
npx expo start
```

Native features need a development build:

```bash
npx expo run:ios
```

## Languages

Spanish and English first. Dutch next.

---

Built by [Arnau López](https://arnau-lopez.com).
