# Nudge V2

This is the improved Android-friendly PWA prototype.

## What changed
- Conversational interaction instead of treating every utterance as a task title.
- Understands phrases such as "in 30 days", "tomorrow", "next Tuesday", and "every 30 days".
- Explicit deferrals such as "I don't need to do it right now; I need to do it in 30 days" are handled as a future reminder.
- Recurring tasks advance when completed.
- Nudge asks follow-up questions when a date is missing.
- Voice input remains available.
- Tasks only appear in Today when actually due.
- Local data stays on the device.

## Install
Upload `index.html`, `manifest.json`, and `sw.js` to the root of the GitHub Pages repository. Then open the Pages URL in Android Chrome and use Chrome's "Add to Home screen"/"Install app" option.

## Important
This version is a local prototype. It does not yet use a real AI backend, account system, cloud sync, calendar integration, or reliable server push notifications.
