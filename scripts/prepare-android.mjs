#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const run = (command, args) => {
  execFileSync(command, args, {
    stdio: 'inherit',
    env: process.env
  });
};

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html is missing. Run npm run build before preparing Android.');
  process.exit(1);
}

if (!existsSync('android')) {
  console.log('Creating Capacitor Android project...');
  run('npx', ['cap', 'add', 'android']);
} else {
  console.log('Capacitor Android project already exists.');
}

console.log('Syncing web assets into Android project...');
run('npx', ['cap', 'sync', 'android']);
