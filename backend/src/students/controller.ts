import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler, writers } from '../middleware/security.js';
import { activitySchema, attemptSchema, idSchema, keySchema, listSchema, patchSchema } from '../validation/schemas.js';
import { listStudents, updateStudent } from './service.js';
import { detail } from './repository.js';
import { createAttempt, recordRejection } from '../attempts/service.js';
import { activity } from '../activity/service.js';
import { ApiError } from '../utils/errors.js';
import { ZodError } from 'zod';
export const students=Router();
export const mutationLimit=rateLimit({windowMs:60_000,limit:60,standardHeaders:'draft-7',legacyHeaders:false,keyGenerator:req=>req.identity.id,handler:(req,res)=>res.status(429).json({code:'RATE_LIMITED',message:'Too many requests. Try again shortly.',requestId:req.requestId,fields:{}})});
students.get('/',asyncHandler(async(req,res)=>res.json(await listStudents(req.identity.tenantId,listSchema.parse(req.query)))));
students.get('/:id',asyncHandler(async(req,res)=>res.json(await detail(req.identity.tenantId,idSchema.parse(req.params.id)))));
students.patch('/:id',writers,mutationLimit,asyncHandler(async(req,res)=>res.json(await updateStudent(req.identity.tenantId,idSchema.parse(req.params.id),patchSchema.parse(req.body)))));
students.post('/:id/attempts',writers,mutationLimit,asyncHandler(async(req,res)=>{
  const id=idSchema.parse(req.params.id);
  try {
    const result=await createAttempt(req.identity,id,keySchema.parse(req.get('Idempotency-Key')),attemptSchema.parse(req.body),req.requestId);
    res.set('Idempotency-Replayed',String(result.replayed)).status(result.status).json(result.body);
  } catch(error) {
    if(error instanceof ApiError || error instanceof ZodError) await recordRejection(req.identity,id,req.requestId,error instanceof ApiError?error.code:'VALIDATION_ERROR');
    throw error;
  }
}));
students.get('/:id/activity',asyncHandler(async(req,res)=>{const q=activitySchema.parse(req.query);res.json(await activity(req.identity.tenantId,idSchema.parse(req.params.id),q.limit,q.cursor));}));
