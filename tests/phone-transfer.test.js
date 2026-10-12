import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { pairingId, readPairing, validPhoto, sendPhoto, MAX_PHOTO_BYTES } from '../src/phone-transfer.js';

test('pairing requires two unguessable identifiers and photo payloads are bounded', () => {
  const peer = pairingId();
  const token = pairingId();
  assert.notEqual(peer, token);
  assert.deepEqual(readPairing(`#peer=${peer}&token=${token}`), { peer, token });
  assert.equal(readPairing('#peer=bad&token=bad'), null);
  const photo = { type: 'photo', id: pairingId(), mime: 'image/png', bytes: new ArrayBuffer(8) };
  assert.equal(validPhoto(photo), true);
  for (const changed of [{ mime: 'text/html' }, { bytes: new ArrayBuffer(0) }, { bytes: new ArrayBuffer(MAX_PHOTO_BYTES + 1) }, { id: '../invalid' }, { bytes: 'not bytes' }]) assert.equal(validPhoto({ ...photo, ...changed }), false);
});

test('phone waits for matching recognition confirmation and removes listeners', async () => {
  const connection = new EventEmitter();
  connection.open = true;
  const id = pairingId();
  const progress = [];
  connection.send = message => {
    assert.equal(validPhoto(message), true);
    queueMicrotask(() => {
      connection.emit('data', { type: 'result', id: 'wrong', ok: true, added: 99 });
      connection.emit('data', { type: 'progress', id, message: 'Reading…' });
      connection.emit('data', { type: 'result', id, ok: true, added: 2, message: 'Done' });
    });
  };
  const result = await sendPhoto(connection, new Blob(['image'], { type: 'image/png' }), id, message => progress.push(message));
  assert.equal(result.added, 2);
  assert.deepEqual(progress, ['Reading…']);
  assert.equal(connection.listenerCount('data'), 0);
  assert.equal(connection.listenerCount('close'), 0);
});

test('chunked phone photos accept byte views without including surrounding bytes', async () => {
  const bytes = new Uint8Array([99, 1, 2, 3, 99]).subarray(1, 4);
  const photo = { type: 'photo', id: pairingId(), mime: 'image/jpeg', bytes };
  assert.equal(validPhoto(photo), true);
  assert.deepEqual([...new Uint8Array(await new Blob([photo.bytes]).arrayBuffer())], [1, 2, 3]);
  for (const changed of [new Uint8Array(0), new Uint8Array(MAX_PHOTO_BYTES + 1), { byteLength: 3 }, new Uint16Array(3)]) {
    assert.equal(validPhoto({ ...photo, bytes: changed }), false);
  }
});

test('phone rejects disconnection and unsupported images without confirming upload', async () => {
  const connection = new EventEmitter();
  connection.open = true;
  connection.send = () => queueMicrotask(() => connection.emit('close'));
  await assert.rejects(sendPhoto(connection, new Blob(['image'], { type: 'image/png' }), pairingId()), /Connection lost/);
  await assert.rejects(sendPhoto(connection, new Blob(['bad'], { type: 'text/html' }), pairingId()), /JPG, PNG or WebP/);
  assert.equal(connection.listenerCount('data'), 0);
});
