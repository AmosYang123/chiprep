export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const idPattern = /^[a-f0-9]{64}$/;
const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];

export function pairingId() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function readPairing(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const peer = params.get('peer');
  const token = params.get('token');
  return idPattern.test(peer || '') && idPattern.test(token || '') ? { peer, token } : null;
}

export function validPhoto(value) {
  return Boolean(value && value.type === 'photo' && idPattern.test(value.id || '') && photoTypes.includes(value.mime) && (value.bytes instanceof ArrayBuffer || value.bytes instanceof Uint8Array) && value.bytes.byteLength > 0 && value.bytes.byteLength <= MAX_PHOTO_BYTES);
}

export async function createPeer() {
  const { default: Peer } = await import('peerjs');
  return new Peer(pairingId());
}

export async function receivePhone({ origin, status, ready, receive }) {
  let peer;
  let connection;
  let closed = false;
  let busy = false;
  let expiry;
  let startup;
  const token = pairingId();
  const completed = new Map();
  const stop = () => { closed = true; clearTimeout(expiry); clearTimeout(startup); peer?.destroy(); };
  const renew = () => {
    clearTimeout(expiry);
    expiry = setTimeout(() => { stop(); status('This code expired. Create a new code to send more photos.'); }, 10 * 60 * 1000);
  };
  try {
    peer = await createPeer();
    renew();
    startup = setTimeout(() => { stop(); status('Could not connect to the pairing service. Check your internet connection and create a new code.'); }, 25000);
    peer.on('error', () => { if (!closed) { stop(); status('Connection failed. Try again on the same Wi-Fi, without a VPN.'); } });
    peer.on('open', async id => {
      if (closed) return;
      clearTimeout(startup);
      try {
        const url = new URL('/phone', origin);
        url.hash = new URLSearchParams({ peer: id, token }).toString();
        const { default: QRCode } = await import('qrcode');
        const qr = await QRCode.toDataURL(url.href, { width: 260, margin: 2 });
        if (!closed) { ready(url.href, qr); status('Scan with your phone on the same Wi-Fi. Keep this panel open. The code expires after 10 minutes without an upload.'); }
      } catch { stop(); status('Could not create the QR code. Close this panel and try again.'); }
    });
    peer.on('connection', incoming => {
      if (closed || incoming.metadata?.token !== token || connection) {
        incoming.on('open', () => incoming.close());
        incoming.close();
        return;
      }
      connection = incoming;
      incoming.on('open', () => { incoming.send({ type: 'ready' }); status('Phone connected. Take a photo, then tap Upload to computer.'); });
      incoming.on('close', () => { if (connection === incoming) connection = undefined; if (!closed) status('Phone disconnected. Scan the code again to reconnect.'); });
      incoming.on('error', () => { incoming.close(); if (!closed) status('Photo connection interrupted. Scan the code again.'); });
      incoming.on('data', async message => {
        if (closed || connection !== incoming || !incoming.open) return;
        if (!validPhoto(message)) { incoming.send({ type: 'result', id: message?.id, ok: false, added: 0, message: 'Choose a JPG, PNG or WebP photo under 8 MB.' }); return; }
        if (completed.has(message.id)) { incoming.send(completed.get(message.id)); return; }
        if (busy) { incoming.send({ type: 'result', id: message.id, ok: false, added: 0, message: 'The computer is reading another photo. Wait, then retry.' }); return; }
        busy = true;
        renew();
        const progress = text => {
          if (closed) return;
          status(text);
          if (incoming.open) incoming.send({ type: 'progress', id: message.id, message: text });
        };
        progress('Photo received. Reading Chinese words…');
        let result;
        try { result = await receive(new File([message.bytes], 'phone-photo', { type: message.mime }), progress); }
        catch { result = { ok: false, added: 0, message: 'The photo could not be read. Try a clearer image.' }; }
        const reply = { type: 'result', id: message.id, ...result };
        if (reply.ok) completed.set(message.id, reply);
        if (completed.size > 30) completed.delete(completed.keys().next().value);
        busy = false;
        if (!closed) { status(reply.message); if (incoming.open) incoming.send(reply); }
      });
    });
  } catch { stop(); status('Photo pairing tools could not load. Check your internet connection and try again.'); }
  return stop;
}

export async function sendPhoto(connection, file, id, onProgress = () => {}) {
  if (!photoTypes.includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES) throw new Error('Choose a JPG, PNG or WebP photo under 8 MB.');
  if (!idPattern.test(id)) throw new Error('Invalid photo identifier. Choose the photo again.');
  if (!connection.open) throw new Error('Computer disconnected. Scan a new QR code.');
  const bytes = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    let deadline;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      connection.off('data', onData);
      connection.off('close', onClose);
      connection.off('error', onClose);
      error ? reject(error) : resolve(result);
    };
    const renew = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('No confirmation from the computer. Keep its page open, then retry this photo.')), 45000); };
    const onClose = () => finish(new Error('Connection lost. Your unsent photos were kept; reconnect and retry.'));
    const onData = message => {
      if (message?.id !== id) return;
      if (message.type === 'progress' && typeof message.message === 'string') { renew(); onProgress(message.message); }
      if (message.type === 'result' && typeof message.ok === 'boolean' && Number.isInteger(message.added)) finish(null, message);
    };
    connection.on('data', onData);
    connection.on('close', onClose);
    connection.on('error', onClose);
    deadline = setTimeout(() => finish(new Error('No confirmation after four minutes. Check your computer before retrying this photo.')), 240000);
    renew();
    try { connection.send({ type: 'photo', id, mime: file.type, bytes }); }
    catch (error) { finish(error); }
  });
}
