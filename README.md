# Nudge MVP

A first Android-friendly prototype of the voice-first personal assistant we designed.

## What works now
- One-screen "Today" view
- Add reminders by typing
- Voice input in supported mobile Chrome environments
- Natural-language basics: "remind me...", "tomorrow", "in two months", "done", "push it to tomorrow", "forget that"
- Complete and postpone buttons
- Local persistence on the device
- Basic settings for follow-up style/personality
- Installable as a PWA when served over HTTPS

## Important
This is deliberately a prototype. It does NOT yet have:
- real AI conversation
- cloud sync
- reliable background push notifications
- calendar integration
- household-maintenance intelligence
- accounts/subscriptions
- production security

## Running on Android
For the best test, serve this folder from an HTTPS host and open it in Chrome on Android. Chrome can then offer "Add to Home screen" / installation.

Voice recognition is browser-dependent and normally requires a secure (HTTPS) context.

The next engineering step is to replace the simple local parser with a real AI backend and add a proper notification/scheduling service.
