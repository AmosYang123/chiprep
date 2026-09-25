# Photos and phone uploads

On the published site, choose **Use phone camera**, scan the QR code, take photos one at a time or choose up to five together, then tap **Upload to computer**. Keep both pages open until the phone confirms the result. Each photo shows receipt, reading progress and its result. The final confirmation gives the total new words added. Successful photos stay confirmed; **Retry unfinished photos** resends only unsuccessful photos. No-Chinese results remain visible as failures so you can retry or replace the photo. The computer adds recognized Chinese words and pinyin to the existing list, skips duplicate words, and saves the list on that browser. Review recognition and pronunciation before studying.

The QR panel closes the connection when dismissed. Codes expire after 10 minutes without an upload; **Create new code** replaces the old connection. One phone can connect at a time. The last five received photos and their individual results remain visible and downloadable until the computer page reloads. Photos are not persisted with the word list.

## Development and deployment

- `npm install`, `npm run build`, `npm test`, `npm run dev`.
- Build copies pinned OCR, QR and connection libraries into `dist/vendor`.
- Vercel serves `dist` and the `/phone` page. The SPA fallback excludes that route.
- Phone pairing requires the deployed site; localhost links cannot be opened from another device.
- No server credentials or database are required. PeerJS Cloud handles connection signaling; WebRTC carries the photos. Internet access is needed for signaling and the initial Chinese OCR language download. Restrictive networks or VPNs can block direct connections; try the same Wi-Fi. There is no managed TURN relay fallback.
- Phone photos are resized to at most 2400 pixels on the longest edge and encoded as JPEG; transfer limit is 8 MB. Local image import accepts up to 20 MB.
- The computer reuses its text reader between photos, releases it after a minute idle, and stops stalled recognition after three minutes. The phone shows progress and reports inactivity or disconnects rather than silently clearing the photo.
- OCR supports simplified and traditional Chinese. Printed text works best. Recognition and word segmentation can be imperfect, and pinyin may need correction.

## Validation

Automated tests cover text extraction, deduplication, import recovery, connection tokens, payload validation, duplicate transfer IDs, busy handling, expiry, acknowledgements, live progress, five-photo batches, partial retries, word counts, reader reuse and timeouts. Browser QA additionally exercises real PeerJS pairing, image preparation, transfer, OCR, saved words, and a 390-pixel phone layout. A physical phone camera and cross-network connections still require hardware testing.

References: [PeerJS connections](https://peerjs.com/client/api/data-connection), [Tesseract.js worker API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [Vercel clean URLs and rewrites](https://vercel.com/docs/project-configuration/vercel-json).
