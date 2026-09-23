import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../database/client.js';
import { listSchema, patchSchema } from '../validation/schemas.js';
import { ApiError, notFound } from '../utils/errors.js';
import { detail } from './repository.js';
const cursorSchema=z.object({id:z.string().uuid(),tenantId:z.string().uuid(),search:z.string(),status:z.string().optional(),sort:z.string()});
function signature(payload:string) { return createHmac('sha256',process.env.JWT_SECRET!).update(payload).digest('base64url'); }
export async function listStudents(tenantId:string,q:z.infer<typeof listSchema>) {
  let cursorId:string|undefined;
  if(q.cursor) {
    try {
      const [payload,sig]=q.cursor.split('.');
      const expected=signature(payload);
      if(!sig || sig.length!==expected.length || !timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw new Error();
      const parsed=cursorSchema.parse(JSON.parse(Buffer.from(payload,'base64url').toString()));
      if(parsed.tenantId!==tenantId || parsed.search!==q.search || parsed.status!==q.status || parsed.sort!==q.sort) throw new Error();
      cursorId=parsed.id;
    } catch {throw new ApiError(400,'VALIDATION_ERROR','Invalid cursor for this query');}
  }
  const where:Prisma.StudentWhereInput={tenantId,status:q.status,...(q.search?{OR:[{name:{contains:q.search,mode:'insensitive'}},{email:{contains:q.search,mode:'insensitive'}}]}:{})};
  if(cursorId && !await db.student.findFirst({where:{...where,id:cursorId},select:{id:true}})) throw new ApiError(400,'VALIDATION_ERROR','Cursor is no longer available; refresh the list');
  const [field,direction]=q.sort.split(':') as ['name'|'email'|'score'|'status'|'createdAt','asc'|'desc'];
  const [rows,total,groups]=await db.$transaction([
    db.student.findMany({where,orderBy:[{[field]:direction},{id:direction}],take:q.limit+1,...(cursorId?{cursor:{id:cursorId},skip:1}:{})}),
    db.student.count({where}),
    db.student.groupBy({by:['status'],where:{tenantId},_count:{_all:true}}),
  ],{isolationLevel:'RepeatableRead'});
  const more=rows.length>q.limit; const items=rows.slice(0,q.limit).map(s=>({...s,score:Number(s.score)}));
  const payload=Buffer.from(JSON.stringify({id:items.at(-1)?.id,tenantId,search:q.search,status:q.status,sort:q.sort})).toString('base64url');
  return {items,total,nextCursor:more?`${payload}.${signature(payload)}`:null,summary:Object.fromEntries(groups.map(g=>[g.status,g._count._all]))};
}
export async function updateStudent(tenantId:string,id:string,input:z.infer<typeof patchSchema>) {
  return db.$transaction(async tx=>{
    const result=await tx.student.updateMany({where:{tenantId,id,version:input.expectedVersion},data:{name:input.name,phone:input.phone,version:{increment:1}}});
    if(!result.count) {
      if(!await tx.student.findFirst({where:{tenantId,id},select:{id:true}})) throw notFound();
      throw new ApiError(409,'CONFLICT','This student changed. Refresh and try again.');
    }
    return detail(tenantId,id,tx);
  });
}
