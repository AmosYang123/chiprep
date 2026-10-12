import test from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { createRequestFromNodeRequest } from 'astro/app/node';
import config from '../astro.config.mjs';

test('production adapter retains trusted localhost and LAN origins', () => {
  for (const { hostname } of config.security.allowedDomains) {
    const socket = new Socket();
    const incoming = new IncomingMessage(socket);
    incoming.headers.host = `${hostname}:4322`;
    incoming.method = 'GET';
    incoming.url = '/api/state';
    const request = createRequestFromNodeRequest(incoming, { allowedDomains: config.security.allowedDomains, port: 4322 });
    assert.equal(new URL(request.url).origin, `http://${hostname}:4322`);
    socket.destroy();
  }
});

test('production adapter ignores an untrusted Host header', () => {
  const socket = new Socket();
  const incoming = new IncomingMessage(socket);
  incoming.headers.host = 'evil.example:4322';
  incoming.method = 'GET';
  incoming.url = '/api/state';
  const request = createRequestFromNodeRequest(incoming, { allowedDomains: config.security.allowedDomains, port: 4322 });
  assert.equal(new URL(request.url).origin, 'http://localhost:4322');
  socket.destroy();
});
