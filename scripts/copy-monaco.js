const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const destination = path.join(__dirname, '..', 'public', 'monaco', 'vs');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  if (!fs.existsSync(source)) {
    console.warn('Monaco source not found, skipping copy:', source);
    process.exit(0);
  }
  copyDir(source, destination);
  console.log('Monaco assets copied to', destination);
} catch (err) {
  console.error('Failed to copy Monaco assets:', err);
  process.exit(1);
}
