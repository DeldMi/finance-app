'use strict';

const fs = require('node:fs');
const path = require('node:path');

const logFile = process.argv[2] || '/app/prisma/logs/application.log';
const maxBytes = 5 * 1024 * 1024;
const retainedFiles = 3;

fs.mkdirSync(path.dirname(logFile), { recursive: true });
let size = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
let descriptor;

function disableFileLogging(error) {
  process.stderr.write(`[log-tee] Arquivo indisponível; mantendo a saída no Docker: ${error.message}\n`);
  if (descriptor !== undefined) {
    try { fs.closeSync(descriptor); } catch { /* Continue without the file sink. */ }
    descriptor = undefined;
  }
}

try { descriptor = fs.openSync(logFile, 'a'); }
catch (error) { disableFileLogging(error); }

function rotate() {
  fs.closeSync(descriptor);
  try { fs.unlinkSync(`${logFile}.${retainedFiles}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (let index = retainedFiles - 1; index >= 1; index -= 1) {
    try { fs.renameSync(`${logFile}.${index}`, `${logFile}.${index + 1}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  try { fs.renameSync(logFile, `${logFile}.1`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  descriptor = fs.openSync(logFile, 'a');
  size = 0;
}

process.stdin.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (descriptor === undefined) return;
  let offset = 0;
  try {
    while (offset < chunk.length) {
      if (size >= maxBytes) rotate();
      const length = Math.min(chunk.length - offset, maxBytes - size);
      fs.writeSync(descriptor, chunk, offset, length);
      offset += length;
      size += length;
    }
  } catch (error) { disableFileLogging(error); }
});

function close() {
  if (descriptor !== undefined) {
    fs.closeSync(descriptor);
    descriptor = undefined;
  }
}
process.stdin.on('end', close);
process.on('SIGTERM', close);
process.on('SIGINT', close);
