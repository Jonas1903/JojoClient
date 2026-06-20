import pkg from 'javascript-obfuscator';
const { obfuscate } = pkg;
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const options = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  deadCodeInjection: false,
  controlFlowFlattening: false,
};

function obfuscateDir(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      obfuscateDir(fullPath);
    } else if (extname(entry) === '.js') {
      const src = readFileSync(fullPath, 'utf8');
      const result = obfuscate(src, options).getObfuscatedCode();
      writeFileSync(fullPath, result, 'utf8');
    }
  }
}

obfuscateDir('dist-electron');
console.log('Electron main process obfuscated.');
