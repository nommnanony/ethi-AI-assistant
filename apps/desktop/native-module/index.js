const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { platform, arch } = process;

let nativeBinding = null;

function isMusl() {
  try {
    const ldd = readFileSync('/proc/self/maps', 'utf8');
    return ldd.includes('libc.musl');
  } catch {
    return false;
  }
}

const triples = {
  'win32-x64': 'win32-x64-msvc',
  'darwin-x64': 'darwin-x64',
  'darwin-arm64': 'darwin-arm64',
  'linux-x64': isMusl() ? 'linux-x64-musl' : 'linux-x64-gnu',
  'linux-arm64': isMusl() ? 'linux-arm64-musl' : 'linux-arm64-gnu',
};

const triple = triples[`${platform}-${arch}`];

if (triple) {
  const filename = `natively-audio.${triple}.node`;
  const paths = [
    join(__dirname, filename),
    join(__dirname, '..', 'node_modules', 'natively-audio', filename),
  ];
  for (const p of paths) {
    if (existsSync(p)) {
      nativeBinding = require(p);
      break;
    }
  }
}

if (!nativeBinding) {
  throw new Error(`Failed to load native binding for ${platform}-${arch}. Run 'npm run build:native' first.`);
}

module.exports = nativeBinding;
