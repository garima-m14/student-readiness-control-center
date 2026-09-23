import 'dotenv/config';
import { app } from './app.js';
import { db, mongo } from './database/client.js';
import { startWorker } from './events/outbox.js';
if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) throw new Error('Set JWT_SECRET to at least 32 random characters');
await db.$connect();
const stop=startWorker();
const server=app.listen(Number(process.env.PORT || 4000),'0.0.0.0',()=>console.log('Readiness API listening'));
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{stop();server.close(()=>{void Promise.all([db.$disconnect(),mongo.close()]).then(()=>process.exit(0));});});
