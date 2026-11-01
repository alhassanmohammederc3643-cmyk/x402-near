// Persistent replay protection for the facilitator. One SHA-256 hash of each settled
// payment payload per line, appended with fsync, so a restart cannot forget a payment
// and accept it twice. The on-chain delegate nonce is the second line of defense.
import fs from 'fs';
import { createHash } from 'crypto';
export class ReplayStore {
  constructor(path = new URL('./.replay-store.jsonl', import.meta.url).pathname) {
    this.path = path;
    this.set = new Set();
    if (fs.existsSync(this.path)) {
      for (const line of fs.readFileSync(this.path, 'utf8').split('\n')) {
        if (line.trim()) this.set.add(line.trim());
      }
    }
  }
  static hash(payload) { return createHash('sha256').update(payload).digest('hex'); }
  has(payload) { return this.set.has(ReplayStore.hash(payload)); }
  add(payload) {
    const h = ReplayStore.hash(payload);
    this.set.add(h);
    const fd = fs.openSync(this.path, 'a');
    fs.writeSync(fd, h + '\n');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  }
}
