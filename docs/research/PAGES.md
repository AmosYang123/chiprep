# Tīng page map

Reference: https://chiprep4u.vercel.app/ (inspected October 11, 2026).

## / — Study space

Header: 听 mark, Tīng, Chinese listening practice, appearance selector.
Heading: Your study space; Add words, choose a mode, and practice.
Session bar: listening recall / pinyin quiz, voice and speed popover, shuffle and tone toggles, start button.
Left column: photo import, language selector, study list actions, dictation explanation, editable list, pronunciation note, tone help, pinyin review inputs.
Right column: word selection cards, selection actions, saved progress, review/remembered groups, progress reset.
Listening state: back and groups navigation, progress, hidden waveform, replay, reveal, rating, previous, keyboard help.
Pinyin state: review first, then characters, answer, feedback and rating.
Group state: remembered/review lists, move individual words, practice a group or all words.

Desktop: 1240px shell, 32px padding; two columns, 0.9fr / 1.1fr; session bar above. Below 950px the session bar wraps. Below 760px columns stack, shell padding becomes 16px, and the header subtitle disappears. Word cards use a responsive grid. Original stylesheets are retained locally, including transitions, speaking animation, and dark appearance.

## /phone — Photo sender (also /phone.html redirect)

Header, upload instructions, connection status, camera and file buttons, five-photo queue, remove/clear, send button, upload status.
Live PeerJS pairing uses a QR code and a token that expires after ten minutes without an upload. Up to five JPG, PNG or WebP photos under 8 MB are sent sequentially over an encrypted WebRTC channel. Each receives an OCR result acknowledgment; unconfirmed photos remain available to retry. The QR link uses the local server's LAN address.

## Assets and sources

Original HTML and JavaScript were saved in `source/` for inspection only. Original JavaScript is not loaded by the clone. HTML and CSS form the presentation; independently written local scripts provide behavior. Fonts are system fonts; the favicon and select icon are inline SVGs. No remote photos or video assets occur on the study page. OCR worker and WebAssembly assets are copied from installed Tesseract packages. Language data downloads when OCR is first used.

Neither /sitemap.xml nor /robots.txt exists on the reference. No main-navigation routes beyond the study space and phone sender were found.
