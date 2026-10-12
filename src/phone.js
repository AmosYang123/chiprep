import { createPeer, readPairing, pairingId, sendPhoto, MAX_PHOTO_BYTES } from './phone-transfer.js';

const $ = selector => document.querySelector(selector);
const pairing = readPairing(location.hash);
let peer;
let connection;
let photos = [];
let urls = [];
let sending = false;
let connected = false;
let startup;

$('#connectionStatus').textContent = pairing ? 'Connecting to your computer…' : 'Open this page by scanning the QR code in your study space.';
function status(text, state) { $('#uploadStatus').textContent = text; $('#uploadStatus').dataset.state = state || ''; }

function render() {
  urls.forEach(url => URL.revokeObjectURL(url));
  urls = [];
  $('#photoQueue').replaceChildren(...photos.map(photo => {
    const li = document.createElement('li');
    li.dataset.state = photo.state || '';
    const image = document.createElement('img');
    image.src = URL.createObjectURL(photo.file);
    image.alt = photo.file.name;
    urls.push(image.src);
    const details = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = photo.file.name;
    const message = document.createElement('p');
    message.textContent = photo.message || 'Ready to upload';
    details.append(label, message);
    const remove = document.createElement('button');
    remove.className = 'ghost';
    remove.textContent = 'Remove';
    remove.disabled = sending;
    remove.setAttribute('aria-label', `Remove ${photo.file.name}`);
    remove.onclick = () => { photos = photos.filter(item => item !== photo); render(); };
    li.append(image, details, remove);
    return li;
  }));
  $('#photoCount').textContent = `${photos.length} of 5 photos`;
  $('#send').disabled = !photos.some(photo => photo.state !== 'done') || !connected || sending;
  $('#clearPhotos').disabled = !photos.length || sending;
  $('#capture').disabled = $('#choose').disabled = !connected || sending;
}

function add(files) {
  const batch = [...files];
  if (photos.length + batch.length > 5 || batch.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > MAX_PHOTO_BYTES)) {
    status('Choose up to 5 JPG, PNG or WebP images, each under 8 MB.', 'error');
    return;
  }
  photos.push(...batch.map(file => ({ file, id: pairingId() })));
  status('Photos ready. Tap Upload to computer.');
  render();
}

async function connect() {
  if (!pairing) return;
  try {
    peer = await createPeer();
    startup = setTimeout(() => { peer.destroy(); $('#connectionStatus').textContent = 'Could not connect. Keep the computer’s panel open and scan a new code.'; }, 25000);
    peer.on('error', () => { connected = false; clearTimeout(startup); $('#connectionStatus').textContent = 'Connection failed. Scan a new code and try the same Wi-Fi.'; render(); });
    peer.on('open', () => {
      connection = peer.connect(pairing.peer, { reliable: true, metadata: { token: pairing.token } });
      connection.on('data', message => {
        if (message?.type === 'ready') {
          clearTimeout(startup);
          connected = true;
          $('#connectionStatus').textContent = 'Connected to your computer. Photos travel through an encrypted connection.';
          render();
        }
      });
      connection.on('close', () => { connected = false; $('#connectionStatus').textContent = 'Computer disconnected. Scan a new code; your photos are kept here.'; render(); });
      connection.on('error', () => { connected = false; $('#connectionStatus').textContent = 'Connection interrupted. Scan a new code.'; render(); });
    });
  } catch { $('#connectionStatus').textContent = 'Could not load photo connection tools. Check your internet connection and retry.'; }
}

$('#capture').onclick = () => $('#captureFile').click();
$('#choose').onclick = () => $('#chooseFile').click();
$('#captureFile').onchange = event => { add(event.target.files); event.target.value = ''; };
$('#chooseFile').onchange = event => { add(event.target.files); event.target.value = ''; };
$('#clearPhotos').onclick = () => { photos = []; render(); status('Choose photos to upload.'); };
$('#send').onclick = async () => {
  if (sending || !connected) return;
  sending = true;
  render();
  let added = 0;
  try {
    for (const photo of photos.filter(item => item.state !== 'done')) {
      photo.state = 'working';
      photo.message = 'Sending to computer…';
      render();
      try {
        const result = await sendPhoto(connection, photo.file, photo.id, message => { status(message, 'working'); photo.message = message; render(); });
        if (!result.ok) throw new Error(result.message || 'The computer could not read this photo.');
        photo.state = 'done';
        photo.message = result.message;
        added += result.added;
      } catch (error) {
        photo.state = 'error';
        photo.message = error.message;
        throw error;
      }
      render();
    }
    status(`Upload confirmed. Added ${added} words on your computer.`, 'done');
  } catch (error) { status(`${error.message} Your unconfirmed photos remain in the queue.`, 'error'); }
  finally { sending = false; render(); }
};
window.addEventListener('pagehide', () => { clearTimeout(startup); peer?.destroy(); urls.forEach(url => URL.revokeObjectURL(url)); });
render();
void connect();
