import { randomBytes } from 'node:crypto';
import { existsSync,writeFileSync,copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const env=new URL('.env',root);
if(existsSync(env)){console.log('.env already exists; no credentials changed.');}
else {
  const dbPassword=randomBytes(24).toString('hex');
  const lines=[`DATABASE_URL=postgresql://readiness:${dbPassword}@localhost:5432/readiness`,'MONGODB_URL=mongodb://localhost:27018/readiness','MONGO_PORT=27018',`POSTGRES_PASSWORD=${dbPassword}`,`JWT_SECRET=${randomBytes(48).toString('base64url')}`,`SEED_PASSWORD=${randomBytes(18).toString('base64url')}`,'FRONTEND_ORIGIN=http://localhost:5173','PORT=4000','COOKIE_SECURE=false','VITE_API_URL=/api'];
  writeFileSync(env,lines.join('\n')+'\n',{mode:0o600});
  console.log('Created local credentials in .env. Use SEED_PASSWORD to sign in.');
}
if(!existsSync(new URL('backend/.env',root)))copyFileSync(fileURLToPath(env),fileURLToPath(new URL('backend/.env',root)));
