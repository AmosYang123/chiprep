# Features

| Page | Control | Behavior | Data | Evidence |
| --- | --- | --- | --- | --- |
| Study | Appearance | System / light / dark, saved locally | theme preference | theme.js, theme.css |
| Study | Study mode | Listening or pinyin; separate progress | mode, remembered keys | app.js |
| Study | Voice / speed / preview | Native Mandarin synthesis at selected speed | browser voices | app.js |
| Study | Shuffle | Shuffle selected round once | selected words | app.js |
| Study | Check tones | Compare accented or numbered pinyin; optional tone-free checking | expected and entered reading | study-core.js |
| Study | Start listening | Reject empty list/selection; test each word once | selected words, round | observed listening flow |
| Study | Review pinyin | Editable review before quiz, preserving unselected rows | list and selected edits | observed pinyin review |
| Study | Camera / Choose photos | File picker; local Chinese OCR; deduplicate extracted words | image files, list | photo-import.js |
| Study | Photo language | Simplified or traditional OCR model | chosen language | HTML |
| Study | Use phone camera | Live PeerJS connection, QR and phone link | expiring random pairing token | phone-receiver.js and phone-transfer.js |
| Study | Create new code / Close | Renew pairing / destroy old connection | peer and token | original phone-transfer.js |
| Study | Dictate words | Native Mandarin recognition, segmented words, pinyin fill | microphone transcription, list | dictation.js |
| Study | Split into words | Segment Chinese text; preserve manually annotated lines | list | dictation.js |
| Study | Add missing pinyin / blur | Fill missing readings, preserve overrides | list | app.js |
| Study | Tone help | Expand native details | none | HTML |
| Study | Individual card / Select all / Clear | Select round words | local skipped characters | app.js |
| Study | Needs review / Remembered | Group board with practice buttons and word reassignment | local remembered keys | app.js |
| Study | Reset progress | Clear current list's progress in active mode | remembered keys | app.js |
| Round | Play again / Space | Speak active word | current word | app.js |
| Round | Reveal | Show Chinese and reading; allow remembered rating | current word | observed |
| Round | Check answer / Enter | Validate pinyin and show feedback | answer | app.js |
| Round | Needs review / Remembered | Save rating and advance once | local progress, round | practice.js |
| Round | Previous / Left arrow | Undo most recent rating | round history | app.js |
| Round | Edit list / Escape / Groups | Return to setup or groups | current list | app.js |
| Phone | Camera / Choose / Remove / Clear | Validate, preview and edit image queue | up to five images | phone.html |
| Phone | Upload | Send queued photos over WebRTC; wait for OCR confirmation; retain failed items | validated image bytes and per-photo IDs | original phone-transfer.js |

Study data is persisted through GET/PATCH /api/state in SQLite, isolated by browser session. Local-storage keys use a clone-specific prefix for migration and recovery. PeerJS's public signaling service pairs devices, as in the original; original application data and services are not accessed.
