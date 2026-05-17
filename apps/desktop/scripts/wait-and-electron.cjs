const { spawn } = require('child_process');
const http = require('http');

const VITE_URL = 'http://localhost:1420';
const MAX_RETRIES = 30;
const RETRY_DELAY = 1000;

async function waitForVite() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(VITE_URL, (res) => {
          resolve(true);
        });
        req.on('error', reject);
        req.setTimeout(1000);
      });
      console.log('Vite server is ready!');
      return true;
    } catch {
      console.log(`Waiting for Vite... (${i + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
  throw new Error('Vite server did not start');
}

async function main() {
  await waitForVite();
  
  const electronPath = require('electron');
  const electron = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });

  electron.on('close', (code) => {
    process.exit(code);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});