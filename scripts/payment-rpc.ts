import {rpc, Keypair, Networks, TransactionBuilder, scValToNative} from '@stellar/stellar-sdk';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {assertNotMainnet} from './network';
const require=createRequire(import.meta.url);
const {create:createFetchClient}=require(join(dirname(require.resolve('@stellar/stellar-sdk')),'http-client/fetch-client.js'));
export async function createPaymentRpc(reportPath:string,signer:Keypair){
 assertNotMainnet(process.env.STELLAR_NETWORK??'testnet','payment');
 const server=new rpc.Server('https://soroban-testnet.stellar.org',{timeout:30000});
 (server as any).httpClient=createFetchClient();
 if((await server.getNetwork()).passphrase!==Networks.TESTNET) throw Error('Wrong network');
 const report:any=existsSync(reportPath)?JSON.parse(await readFile(reportPath,'utf8')):{network:'testnet',transactions:[],contracts:{}};
 if(report.network!=='testnet')throw Error('Wrong receipt network');
 const save=async()=>{await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');};
 async function simulate(op:any,key=signer){
 const raw=new TransactionBuilder(await server.getAccount(key.publicKey()),{fee:'100000',networkPassphrase:Networks.TESTNET}).addOperation(op).setTimeout(180).build();
 return {raw,sim:await server.simulateTransaction(raw)};
 }
 async function read(op:any){const {sim}=await simulate(op);if(!rpc.Api.isSimulationSuccess(sim))throw Error('Read failed: '+JSON.stringify(sim));return scValToNative(sim.result!.retval);}
 async function tx(op:any,label:string,key=signer){
 let entry=report.transactions.find((e:any)=>e.label===label);
 if(entry?.status==='FAILED')throw Error('Previously failed '+label+' '+entry.hash);
 if(!entry){
 const {raw,sim}=await simulate(op,key);
 if(!rpc.Api.isSimulationSuccess(sim))throw Error('Simulation '+label+': '+JSON.stringify(sim));
 const ready=rpc.assembleTransaction(raw,sim).build();ready.sign(key);
 entry={label,hash:ready.hash().toString('hex'),status:'SUBMITTING',source:key.publicKey()};
 entry.url='https://stellar.expert/explorer/testnet/tx/'+entry.hash;
 report.transactions.push(entry);await save();
 const sent=await server.sendTransaction(ready);entry.submissionStatus=sent.status;await save();
 if(!['PENDING','DUPLICATE'].includes(sent.status))throw Error('Send rejected '+label+' '+sent.status);
 }
 const deadline=Date.now()+240000;
 while(Date.now()<deadline){const result=await server.getTransaction(entry.hash);
 if(result.status==='SUCCESS'){entry.status='SUCCESS';entry.ledger=result.ledger;await save();console.log('Confirmed',label,entry.hash);return result;}
 if(result.status==='FAILED'){entry.status='FAILED';await save();throw Error('Transaction failed '+label+' '+entry.hash);}
 if(entry.status==='SUCCESS')throw Error('Confirmed transaction aged out of RPC; refusing resubmission '+entry.hash);
 await Bun.sleep(1500);}
 throw Error('Pending or unavailable '+label+' '+entry.hash+'; rerun checks saved hash without resubmitting');
 }
 return {server,tx,read,simulate,save,report};
}
