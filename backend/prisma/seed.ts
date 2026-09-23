import 'dotenv/config';
import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { db } from '../src/database/client.js';
import { weights } from '../src/competencies/catalog.js';
import { calculateReadiness } from '../src/readiness/domain.js';
export async function seed() {
  const password=process.env.SEED_PASSWORD;
  if(!password || password.length<12) throw new Error('SEED_PASSWORD must have at least 12 characters');
  const passwordHash=await bcrypt.hash(password,12);
  for(const [id,weight] of Object.entries(weights)) await db.competency.upsert({where:{id},create:{id,weight},update:{weight}});
  for(const name of ['Acme Training','Northstar Academy']) {
    const tenant=await db.tenant.upsert({where:{name},create:{name},update:{}});
    const slug=name.startsWith('Acme')?'acme':'northstar';
    const users:User[]=[];
    for(const role of ['ADMIN','EVALUATOR','VIEWER'] as const) users.push(await db.user.upsert({where:{tenantId_email:{tenantId:tenant.id,email:`${role.toLowerCase()}@${slug}.test`}},create:{tenantId:tenant.id,name:`${slug==='acme'?'Alex Morgan':'Jordan Lee'} · ${role.toLowerCase()}`,email:`${role.toLowerCase()}@${slug}.test`,passwordHash,role},update:{}}));
    const names=slug==='acme'?['Olivia Chen','James Wilson','Amara Okafor','Noah Patel','Sofia Martinez','Ethan Brooks','Isabella Kim','Liam Anderson','Mia Thompson','Lucas Rivera','Ava Williams','Benjamin Scott']:['Harper Davis','Henry Lewis','Evelyn Walker','Jack Hall','Charlotte Young','Leo Allen','Grace King','Daniel Wright','Ella Hill','Owen Green','Lily Adams','Arjun Shah'];
    for(const [index,studentName] of names.entries()) {
      const email=studentName.toLowerCase().replace(' ','.')+`@${slug}.students.test`;
      if(await db.student.findUnique({where:{tenantId_email:{tenantId:tenant.id,email}}})) continue;
      await db.$transaction(async tx=>{
        const student=await tx.student.create({data:{tenantId:tenant.id,name:studentName,email,phone:null}});
        const target=[91,72,58,42,86][index%5];
        for(const [i,competencyId] of Object.keys(weights).entries()) {
          if(index%5===4 && i===3) continue;
          for(const [round,score] of [Math.max(0,target-14),target].entries()) await tx.attempt.create({data:{tenantId:tenant.id,studentId:student.id,competencyId,score,evaluatorId:users[1].id,attemptedAt:new Date(`2026-09-${round===0?'12':'20'}T10:00:00Z`)}});
        }
        // Equal-time evidence, deterministic UUID tie-break, and a voided latest record.
        await tx.attempt.create({data:{tenantId:tenant.id,studentId:student.id,competencyId:'frontend',score:target,evaluatorId:users[1].id,attemptedAt:new Date('2026-09-20T10:00:00Z')}});
        await tx.attempt.create({data:{tenantId:tenant.id,studentId:student.id,competencyId:'frontend',score:0,evaluatorId:users[1].id,attemptedAt:new Date('2026-09-21T10:00:00Z'),voidedAt:new Date()}});
        const evidence=await tx.attempt.findMany({where:{tenantId:tenant.id,studentId:student.id}});
        const readiness=calculateReadiness(evidence.map(a=>({...a,score:Number(a.score)})));
        await tx.student.update({where:{tenantId_id:{tenantId:tenant.id,id:student.id}},data:{score:readiness.score,status:readiness.status}});
      });
    }
  }
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/seed.ts')) {await seed();await db.$disconnect();}
