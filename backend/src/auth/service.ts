import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../database/client.js';
import { findLoginUser, findSession } from '../users/repository.js';
import { requireActive } from '../tenants/policy.js';
import { ApiError } from '../utils/errors.js';
import { loginSchema } from '../validation/schemas.js';
const secret = () => { const value=process.env.JWT_SECRET; if(!value || value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters'); return value; };
const dummyHash = bcrypt.hashSync('non-user-timing-comparison', 12);
export async function login(input:z.infer<typeof loginSchema>) {
  const user=await findLoginUser(input.organization,input.email);
  const valid=await bcrypt.compare(input.password,user?.passwordHash || dummyHash);
  if (!user || !valid) throw new ApiError(401,'AUTH_REQUIRED','Invalid organization, email or password');
  const session=await db.session.create({data:{userId:user.id,expiresAt:new Date(Date.now()+8*3600_000)}});
  return {token:jwt.sign({sid:session.id},secret(),{subject:user.id,expiresIn:'8h',issuer:'readiness',audience:'readiness-web',algorithm:'HS256'}),user:identity(user),sessionId:session.id};
}
type IdentitySource = {id:string;tenantId:string;name:string;email:string;role:'ADMIN'|'EVALUATOR'|'VIEWER';tenant:{name:string}};
export const identity = (user:IdentitySource) => ({id:user.id,tenantId:user.tenantId,name:user.name,email:user.email,role:user.role,tenantName:user.tenant.name});
export type Identity = ReturnType<typeof identity> & {sessionId:string};
export async function authenticate(token:string):Promise<Identity> {
  let payload;
  try {payload=z.object({sub:z.string().uuid(),sid:z.string().uuid()}).parse(jwt.verify(token,secret(),{algorithms:['HS256'],issuer:'readiness',audience:'readiness-web'}));}
  catch {throw new ApiError(401,'AUTH_REQUIRED','Please sign in again');}
  const session=await findSession(payload.sid);
  if(!session || session.revokedAt || session.expiresAt < new Date() || session.userId !== payload.sub) throw new ApiError(401,'AUTH_REQUIRED','Please sign in again');
  requireActive(session.user.tenant.status);
  return {...identity(session.user),sessionId:session.id};
}
export const logout = (sessionId:string) => db.session.updateMany({where:{id:sessionId},data:{revokedAt:new Date()}});
