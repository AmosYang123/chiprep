# Assumptions and operating limits

- Phone pairing: live PeerJS pairing uses an expiring QR token; a phone must be able to reach the computer's LAN URL. Internet access is needed for the signaling service, and networks can block WebRTC.
- Split into words: uses browser Chinese word segmentation, which may split phrases differently from the original.
- Pinyin: automatic readings use pinyin-pro; names and words with multiple pronunciations need manual review.
- Audio and dictation: depend on browser Mandarin voices, microphone permission, and speech-recognition support.
- Photos: OCR runs locally; first use downloads language data and recognition may make mistakes.
- Persistence: the original has no accounts. This clone stores each browser's study data in a private SQLite workspace, with local recovery of unsaved changes. Clearing the browser session cookie starts a separate workspace, but that workspace can be seeded with this browser's recovered local copy, so clearing the cookie alone does not create a fresh blank list.
