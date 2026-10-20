import fs from 'fs';
const k=JSON.parse(fs.readFileSync('.keys.json'));
const sfx=Math.random().toString(36).slice(2,7);
for(const r of ['buyer','seller','facilitator']){
  const id=`x402near-${r}-${sfx}.testnet`;
  const res=await fetch('https://helper.testnet.near.org/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newAccountId:id,newAccountPublicKey:k[r].pub})});
  console.log(r,id,res.status,(await res.text()).slice(0,200));
  if(res.ok){k[r].account=id;}
}
fs.writeFileSync('.keys.json',JSON.stringify(k,null,1),{mode:0o600});
