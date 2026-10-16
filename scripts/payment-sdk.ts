#!/usr/bin/env bun
/** Authorized testnet-only tutorial demonstration. Public receipt contains no bearer notes. */
import {Address,Asset,Contract,Keypair,Networks,Operation,StrKey,nativeToScVal,scValToNative,rpc} from '@stellar/stellar-sdk';
import {commitment,nullifierHash,MerkleTree,FIELD_MODULUS} from '@zk-pay/shared';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {createPaymentRpc} from './payment-rpc';
import {proveWithdrawGroth16} from './prove-withdraw';
import {readEnvFile,writeEnv} from './env';
import {assertNotMainnet} from './network';
const ROOT=join(import.meta.dir,'..');
const addr=(s:string)=>new Address(s).toScVal();
const uint=(n:bigint)=>nativeToScVal(n,{type:'u256'});
const bytes=(b:Uint8Array)=>nativeToScVal(Buffer.from(b));
const get=(url:string)=>fetch(url,{signal:AbortSignal.timeout(30000)});
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
async function main(){
 process.chdir(ROOT);assertNotMainnet(process.env.STELLAR_NETWORK??'testnet','payment:sdk');
 const env=await readEnvFile();if(env.STELLAR_NETWORK&&env.STELLAR_NETWORK!=='testnet')throw Error('Testnet only');
 const privatePath=join(ROOT,'artifacts/circom/withdraw/payment.secret');await mkdir(join(ROOT,'artifacts/circom/withdraw'),{recursive:true});
 let state:any;
 if(existsSync(privatePath))state=JSON.parse(await readFile(privatePath,'utf8'));
 else {const fr=()=> (BigInt('0x'+randomBytes(32).toString('hex'))%FIELD_MODULUS).toString();state={keys:Object.fromEntries(['alice','charlie','recipient'].map(n=>[n,Keypair.random().secret()])),notes:[{nullifier:fr(),secret:fr()},{nullifier:fr(),secret:fr()}]};await writeFile(privatePath,JSON.stringify(state),{mode:0o600});}
 if(state.spendIndex===undefined){state.spendIndex=randomBytes(1)[0]%2;await writeFile(privatePath,JSON.stringify(state),{mode:0o600});}
 await chmod(privatePath,0o600);
 const deployer=Keypair.fromSecret(env.DEPLOYER_SECRET),wallets=Object.fromEntries(Object.entries(state.keys).map(([n,s])=>[n,Keypair.fromSecret(s as string)]));
 const {tx,read,simulate,report,save}=await createPaymentRpc(join(ROOT,'docs/evidence/private-payment.json'),deployer);
 report.scope='Real fixed-denomination Circom Groth16 ZK membership payment on Stellar testnet; educational setup only';
 report.denominationStroops='10000000';report.wallets=Object.fromEntries(Object.entries(wallets).map(([n,k])=>[n,k.publicKey()]));
 report.funding??={};await save();
 for(const [n,k] of Object.entries(wallets)){
 if(report.funding[n]?.confirmed)continue;
 const existing=await get('https://horizon-testnet.stellar.org/accounts/'+k.publicKey());
 if(existing.status===404){const response=await get('https://friendbot.stellar.org?addr='+encodeURIComponent(k.publicKey()));if(!response.ok)throw Error('Friendbot failed '+response.status);const result:any=await response.json();report.funding[n]={provider:'Stellar Friendbot',address:k.publicKey(),hash:result.hash??null,confirmed:result.successful===true};await save();}
 else if(!existing.ok)throw Error('Horizon failed '+existing.status);
 const history=await get('https://horizon-testnet.stellar.org/accounts/'+k.publicKey()+'/transactions?order=asc&limit=1');if(!history.ok)throw Error('Funding history unavailable');const first:any=(await history.json() as any)._embedded.records[0];
 if(!first?.successful)throw Error('Funding not confirmed');
 report.funding[n]={...report.funding[n],provider:'Stellar Friendbot',address:k.publicKey(),hash:first.hash,source:first.source_account,confirmed:true};await save();
 }
 if(new Set(Object.values(report.wallets)).size!==3)throw Error('Wallets must be distinct');
 if([wallets.alice.publicKey(),wallets.charlie.publicKey()].includes(report.funding.recipient.source))throw Error('Recipient was funded by a depositor');
 const wasm=await readFile(join(ROOT,'target/wasm32v1-none/release/pool.wasm'));
 const verifierWasm=await readFile(join(ROOT,'target/wasm32v1-none/release/verifier_groth16.wasm'));
 const vk=await readFile(join(ROOT,'artifacts/circom/withdraw/vk-final.bin'));
 const hashes={pool:sha(wasm),verifier:sha(verifierWasm),vk:sha(vk)};
 if(report.artifactSha256&&JSON.stringify(report.artifactSha256)!==JSON.stringify(hashes))throw Error('Deployment artifacts changed; refusing mismatched receipt reuse');
 report.artifactSha256=hashes;await save();
 async function deploy(name:string,code:Buffer,args:any[]){if(report.contracts[name])return report.contracts[name];const upload=await tx(Operation.uploadContractWasm({wasm:code}),'upload '+name);const result=await tx(Operation.createCustomContract({address:new Address(deployer.publicKey()),wasmHash:scValToNative(upload.returnValue!),constructorArgs:args}),'deploy '+name);report.contracts[name]=scValToNative(result.returnValue!);await save();return report.contracts[name];}
 const verifier=await deploy('withdrawVerifier',verifierWasm,[]);
 const token=Asset.native().contractId(Networks.TESTNET);
 const poolId=await deploy('pool',wasm,[addr(deployer.publicKey()),addr(token),nativeToScVal(10000000n,{type:'i128'}),addr(verifier),bytes(vk)]);
 const pool=new Contract(poolId),native=new Contract(token);
 const notes=state.notes.map((n:any)=>({nullifier:BigInt(n.nullifier),secret:BigInt(n.secret)}));
 const tree=new MerkleTree();report.deposits??=[];
 for(let i=0;i<2;i++){const key=i===0?wallets.alice:wallets.charlie,c=commitment(notes[i]);const result=await tx(pool.call('deposit',addr(key.publicKey()),uint(c)),'deposit '+i,key);const index=Number(scValToNative(result.returnValue!));if(index!==i)throw Error('Unexpected deposit index');tree.insert(c);report.deposits[i]={source:key.publicKey(),commitment:c.toString(),index,amountStroops:'10000000',hash:report.transactions.find((e:any)=>e.label==='deposit '+i).hash};await save();}
 const root=BigInt(await read(pool.call('current_root')));if(root!==tree.root())throw Error('On-chain Merkle root differs from deposited commitments');
 if(Number(await read(pool.call('next_index')))!==2)throw Error('Unexpected on-chain deposit count');
 const merkleProof=tree.proof(state.spendIndex),recipient=wallets.recipient.publicKey();
 const recipientField=BigInt('0x'+Buffer.from(StrKey.decodeEd25519PublicKey(recipient)).toString('hex'))%FIELD_MODULUS;
 const proofPath=join(ROOT,'artifacts/circom/withdraw/payment-proof.json');
 let proof:{proof:Uint8Array,publicInputs:Uint8Array,vk:Uint8Array};
 if(existsSync(proofPath)){const saved=JSON.parse(await readFile(proofPath,'utf8'));if(saved.root!==root.toString()||saved.recipient!==recipient)throw Error('Saved proof context mismatch');proof={proof:Buffer.from(saved.proof,'hex'),publicInputs:Buffer.from(saved.publicInputs,'hex'),vk:Buffer.from(saved.vk,'hex')};}
 else {proof=await proveWithdrawGroth16({note:notes[state.spendIndex],merkleProof,recipient:recipientField,fee:0n});await writeFile(proofPath,JSON.stringify({root:root.toString(),recipient,proof:Buffer.from(proof.proof).toString('hex'),publicInputs:Buffer.from(proof.publicInputs).toString('hex'),vk:Buffer.from(proof.vk).toString('hex')}),{mode:0o600});}
 if(sha(proof.vk)!==sha(vk))throw Error('Proof VK differs from immutable pool-pinned verifier key');
 const nh=nullifierHash(notes[state.spendIndex].nullifier);
 const withdraw=(p:Uint8Array)=>pool.call('withdraw',bytes(p),uint(root),uint(nh),addr(recipient),nativeToScVal(0n,{type:'i128'}),addr(deployer.publicKey()));
 report.root=root.toString();report.nullifierHash=nh.toString();report.recipientField=recipientField.toString();report.proofSha256=sha(proof.proof);await save();
 const rejected=async(label:string,op:any,code:number)=>{const {sim}=await simulate(op,wallets.recipient);if(!rpc.Api.isSimulationError(sim))throw Error('Expected rejected simulation '+label);if(!new RegExp('Error\\(Contract, #'+code+'\\)').test(sim.error))throw Error('Unexpected rejection reason '+label+': '+sim.error);report.rejections??={};report.rejections[label]={status:'SIMULATION_REJECTED',contractErrorCode:code,error:sim.error.split('\n')[0],diagnosticsSha256:sha(Buffer.from(sim.error)),checkedAt:new Date().toISOString()};await save();};
 if(!report.transactions.some((e:any)=>e.label==='withdraw'&&e.status==='SUCCESS')){
 const tampered=Uint8Array.from(proof.proof);tampered[Math.floor(tampered.length/2)]^=1;
 if(!report.rejections?.tamperedProof){if(await read(pool.call('is_spent',uint(nh)))!==false)throw Error('Tamper test requires unspent note');await rejected('tamperedProof',withdraw(tampered),5);}
 report.recipientBalanceBefore??=String(await read(native.call('balance',addr(recipient))));await save();
 }
 await tx(withdraw(proof.proof),'withdraw',wallets.recipient);
 await rejected('doubleSpend',withdraw(proof.proof),4);
 report.recipientBalanceAfter=String(await read(native.call('balance',addr(recipient))));
 const withdrawHash=report.transactions.find((e:any)=>e.label==='withdraw').hash;
 let withdrawal:any;
 for(let i=0;i<20;i++){const response=await get('https://horizon-testnet.stellar.org/transactions/'+withdrawHash);if(response.ok){withdrawal=await response.json();break;}await Bun.sleep(1000);}
 if(!withdrawal?.successful||withdrawal.source_account!==recipient)throw Error('Recipient-authorized withdrawal fee receipt unavailable');
 report.withdrawalFeeStroops=String(withdrawal.fee_charged);
 const delta=BigInt(report.recipientBalanceAfter)-BigInt(report.recipientBalanceBefore);
 if(delta+BigInt(withdrawal.fee_charged)!==10000000n)throw Error('Recipient balance delta plus paid transaction fee mismatch');
 if(await read(pool.call('is_spent',uint(nh)))!==true)throw Error('Nullifier not marked spent');
 report.recipientBalanceDelta=delta.toString();report.grossPayoutStroops='10000000';report.completedAt=new Date().toISOString();
 report.zeroKnowledge=true;report.provingPath='circom-groth16';report.privacyLimitations=['Local one-party Groth16 setup is not a production multi-party trusted ceremony','Two-depositor anonymity set is small','Timing, public funding and withdrawal recipient remain observable','Recipient must authorize withdrawal, and pays its transaction fee','Local trusted prover sees the bearer note; no production privacy claim'];await save();
 await writeEnv({POOL_ID:poolId,VITE_POOL_ID:poolId,WITHDRAW_G16_VERIFIER_ID:verifier,VITE_WITHDRAW_G16_VERIFIER_ID:verifier});
 console.log('Groth16 testnet payment confirmed; public receipt docs/evidence/private-payment.json');
}
if(import.meta.main)try{await main();}catch(error){console.error(String(error).replace(/S[A-Z2-7]{55}/g,'[REDACTED_SECRET]'));process.exitCode=1;}
