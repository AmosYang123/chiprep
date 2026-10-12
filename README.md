# Tīng local clone

Working local clone of https://chiprep4u.vercel.app/. Local use only.

```sh
npm install
npm run dev
npm test
npm run build
npm start
```

Open http://127.0.0.1:4322/. Pages: `/` and `/phone`.

Use **New set** to save a named collection, then choose it to edit or study just those words. **All** combines the sets without duplicate word/readings; choose an individual set to import or edit. Existing words are kept in **My words**. Sets and the selected view survive reload. **Undo change** restores the last edit, import, selection, set deletion, or progress change (up to 20 changes in the current session). Words shared between sets share their learning progress.

Dictation shows interim text, adds each final result once, and preserves spoken entries rather than splitting compound words. Say one Mandarin word at a time with pauses; check recognized characters and automatically generated pinyin, especially names and multiple-pronunciation words. Dictation accuracy still depends on your browser's speech service.

The original markup and styles are preserved; application logic is written independently. Study lists, word selection and progress are stored in `data/ting.sqlite`, with a private HttpOnly session cookie per browser. The app imports existing preview data automatically and keeps a browser recovery copy of edits until the server confirms them. Clearing the session cookie creates a separate workspace, but that workspace can be seeded with this browser's recovered local copy, so clearing the cookie alone does not create a fresh blank list; there are no accounts or cross-device list synchronization in the original UI.

Pinyin is generated with pinyin-pro. Mandarin playback and dictation use browser speech APIs. Tesseract performs local image recognition; its language models download on first use. PeerJS pairs the phone and computer using an expiring QR token. Photos travel over an encrypted WebRTC data channel and are confirmed after recognition. The public PeerJS signaling service needs internet access; images are not uploaded to the SQLite backend.

For phone uploads, keep the computer's QR panel open and use the same Wi-Fi. The server listens on port 4322 on local network interfaces, and the QR link uses the computer's LAN address. A firewall or network isolation can prevent a phone reaching it. Rebuild after switching networks so Astro's trusted-host allowlist includes the current LAN address. Native microphone access may require HTTPS on a LAN URL; use localhost on the computer for dictation.

`GET /api/state` creates or loads a private workspace. `PATCH /api/state` validates and atomically saves list, selection and mode-specific progress. Cross-site writes, unknown fields, missing sessions and oversized input are rejected. Database files are ignored by Git. Back up `data/` if you want to preserve study history across moving the project.

Research, assumptions and comparison screenshots are in `docs/`. Build and 23 tests pass. Production browser checks cover three sets of 40 words surviving reload, the All view, per-set study, Undo, mocked speech-result handling, session isolation, LAN access and live phone transfer with OCR. No public deployment has been created.
