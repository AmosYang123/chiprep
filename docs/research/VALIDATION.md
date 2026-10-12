# Clone validation

Verified October 11, 2026:

- `npm test`: 15 tests pass, covering frontend parsing, tones and OCR merging; phone token/photo validation, acknowledgment and disconnect handling; SQLite persistence and browser isolation; bad data and cross-site rejection; preview migration, failed-save recovery and in-flight edits; trusted localhost/LAN origins.
- `npm run build`: passes with Astro's standalone Node adapter; study space, phone sender and state API generated.
- Desktop at 1440px and mobile at 390px: comparison screenshots match the reference layout; no horizontal overflow.
- Browser assertions: empty selection rejected; listening reveal and rating work; Previous undoes a rating; saved progress appears; pinyin review precedes the quiz; numbered-tone answer accepted; word groups open.
- Live OCR check: browser-generated image containing 中国 学校 recognized and added both words with correct pinyin. Tesseract logs warnings about obsolete language-model parameters, but recognition succeeds.
- Phone transfer: production receiver generated QR; a second browser page opened the LAN link, paired over live PeerJS, sent a generated 北京 老师 image, and received an acknowledgment for two recognized words. Both were present in SQLite and survived reload. Queue buttons are disabled until the computer confirms pairing.
- Backend production checks: previously pending edits recovered after fixing the trusted-host configuration; lists, listening progress and reset survived reload; an isolated browser session saved through the LAN IP and could not read the first session's list. Database reopening is covered by an automated test.

Not exercised: a physical phone camera, real microphone input, audible playback on the user's device, and traditional Chinese OCR. The transfer test used separate browser pages and a generated image over the real network/signaling protocol.

Updated October 12, 2026:

- Build and all 23 tests pass, including saved-set validation, isolation, offline recovery, exact-key aggregation, contextual readings, dictated entry boundaries, and chunked photo byte views.
- Isolated production browser: three sets of 40 synthetic entries saved and survived reload; All showed 120 entries, and individual practice used 40. Undo restored an edited set. Existing user-browser data was not replaced with the test entries.
- Mocked speech recognition: interim text appeared, repeated final events added only two unique words, a late result after switching sets did not write into the new set, and Undo restored the earlier list. This checks application handling, not microphone or transcription quality.
- Phone capture control opened its file chooser with `capture="environment"`. A generated 19,725-byte JPEG containing 银行 and 音乐 went from the LAN phone page over live PeerJS to OCR; the computer added both with `yín háng` and `yīn yuè`, and the phone received successful confirmation. Fixed rejection of large/chunked photos decoded by PeerJS as Uint8Array.
- Physical phone camera, real microphone transcription, and audible playback remain unverified. Automatic OCR and pinyin require review; progress persistence still caps at 2,000 word keys.

Reference JavaScript was read as data only. No public deployment was created. Generated test words and progress were removed from the browser test workspace before handoff; the production server remains available on 127.0.0.1:4322 and the local LAN interface.
