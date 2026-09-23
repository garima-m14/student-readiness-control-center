import { events, db } from '../database/client.js';
import { notFound } from '../utils/errors.js';
export async function activity(tenantId:string,studentId:string,limit:number,cursor?:string) {
  if(!await db.student.findFirst({where:{tenantId,id:studentId},select:{id:true}})) throw notFound();
  const items=await events.find({tenantId,studentId,...(cursor?{eventId:{$lt:cursor}}:{})},{projection:{_id:0,eventId:1,type:1,studentId:1,attemptId:1,requestId:1,occurredAt:1,metadata:1}}).sort({eventId:-1}).limit(limit+1).toArray();
  return {items:items.slice(0,limit),nextCursor:items.length>limit?String(items[limit-1].eventId):null,pending:await db.outbox.count({where:{tenantId,studentId,deliveredAt:null}})};
}
export async function metrics(tenantId:string) {
  const duplicates=await events.aggregate([{$match:{tenantId,type:'attempt.succeeded'}},{$group:{_id:{tenantId:'$tenantId',attemptId:'$attemptId'},count:{$sum:1}}},{$match:{count:{$gt:1}}},{$limit:100}]).toArray();
  const [success,rejected,pending]=await Promise.all([events.countDocuments({tenantId,type:'attempt.succeeded'}),events.countDocuments({tenantId,type:'attempt.rejected'}),db.outbox.count({where:{tenantId,deliveredAt:null}})]);
  return {tenantId,success,rejected,total:success+rejected,rejectionRate:success+rejected?rejected/(success+rejected):0,pending,duplicates};
}
