import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { networkInterfaces } from 'node:os';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  security: {
    allowedDomains: ['localhost', '127.0.0.1', ...Object.values(networkInterfaces()).flatMap(interfaces => interfaces || []).filter(network => network.family === 'IPv4' && !network.internal).map(network => network.address)].map(hostname => ({ hostname, protocol: 'http', port: '4322' })),
  },
  devToolbar: { enabled: false },
  redirects: { '/phone.html': '/phone' },
});
