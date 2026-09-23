import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
const url=new URL(process.env.DATABASE_URL!);
if(!['/readiness','/readiness_test'].includes(url.pathname))throw new Error('Only local readiness databases may be used by the test runner');
const admin=new PrismaClient();
try {await admin.$executeRawUnsafe('CREATE DATABASE readiness_test');} catch(error) {if(!(error instanceof Error && 'meta' in error && JSON.stringify(error.meta).includes('42P04')))throw error;}finally{await admin.$disconnect();}
url.pathname='/readiness_test';process.env.DATABASE_URL=url.toString();
const mongoUrl=new URL(process.env.MONGODB_URL!);mongoUrl.pathname='/readiness_test';process.env.MONGODB_URL=mongoUrl.toString();
function run(module:string,args:string[]){const result=spawnSync(process.execPath,[module,...args],{stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status??1);}
run('../node_modules/prisma/build/index.js',['migrate','deploy']);
run('../node_modules/vitest/vitest.mjs',['run','tests/integration.test.ts','--maxWorkers=1','--minWorkers=1']);
