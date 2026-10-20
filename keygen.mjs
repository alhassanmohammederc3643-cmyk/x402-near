import {KeyPair} from 'near-api-js';
import fs from 'fs';
const out={};
for (const r of ['buyer','seller','facilitator']){
  const kp=KeyPair.fromRandom('ed25519');
  const pub=kp.getPublicKey().toString();
  const hex=Buffer.from(kp.getPublicKey().data).toString('hex');
  out[r]={account:hex,secret:kp.toString(),pub};
}
fs.writeFileSync('.keys.json',JSON.stringify(out,null,1),{mode:0o600});
for(const r in out)console.log(r,out[r].account);
