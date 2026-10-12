process.env.HOST ||= '0.0.0.0';
process.env.PORT ||= '4322';
await import('../dist/server/entry.mjs');
