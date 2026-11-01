// Replay store unit test: persists across restarts. No keys, no chain. Run: node replay-test.mjs
import fs from 'fs';
import { ReplayStore } from './replay-store.mjs';
const path = '/tmp/replay-test-' + Date.now() + '.jsonl';
let bad = 0; const t = (n, ok) => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', n); };
const a = new ReplayStore(path);
t('new payload not seen', !a.has('payload-1'));
a.add('payload-1');
t('added payload is seen', a.has('payload-1'));
const b = new ReplayStore(path); // simulate a facilitator restart
t('settled payment survives a restart', b.has('payload-1'));
t('different payload not seen', !b.has('payload-2'));
b.add('payload-2');
const c = new ReplayStore(path);
t('two entries both persist', c.has('payload-1') && c.has('payload-2'));
fs.unlinkSync(path);
process.exit(bad ? 1 : 0);
