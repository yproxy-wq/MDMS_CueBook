// Stage the compiled R2 entry point without unrelated Dropbox configuration.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'functions');
const target = path.join(root, 'functions-r2');
fs.mkdirSync(path.join(target, 'lib'), { recursive: true });
for (const name of ['r2Storage.js', 'r2AudioPolicy.js']) {
  fs.copyFileSync(path.join(source, 'lib', name), path.join(target, 'lib', name));
}
const settings = path.join(source, '.env.cuebook-biz-xtv');
if (!fs.existsSync(settings)) throw new Error('Configure functions/.env.cuebook-biz-xtv first.');
const entries = Object.fromEntries(fs.readFileSync(settings, 'utf8').split(/\r?\n/).filter(line => /^R2_(ACCOUNT_ID|BUCKET_NAME)=/.test(line)).map(line => {
  const split = line.indexOf('=');
  return [line.slice(0, split), line.slice(split + 1).trim().replace(/^(["'])(.*)\1$/, '$2')];
}));
if (!/^[a-f0-9]{32}$/i.test(entries.R2_ACCOUNT_ID || '')) throw new Error('R2_ACCOUNT_ID must contain 32 hexadecimal characters.');
if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(entries.R2_BUCKET_NAME || '')) throw new Error('R2_BUCKET_NAME is invalid.');
fs.writeFileSync(path.join(target, '.env.cuebook-biz-xtv'), `R2_ACCOUNT_ID=${entries.R2_ACCOUNT_ID}\nR2_BUCKET_NAME=${entries.R2_BUCKET_NAME}\n`);
console.log('Prepared isolated R2 Functions package.');
