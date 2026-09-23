import type { Request, Response, NextFunction } from 'express';
import { authenticate, type Identity } from '../auth/service.js';
import { ApiError } from '../utils/errors.js';
declare global { namespace Express { interface Request { identity:Identity; requestId:string; } } }
export const asyncHandler = (fn:(req:Request,res:Response)=>Promise<unknown>) => (req:Request,res:Response,next:NextFunction) => {Promise.resolve(fn(req,res)).catch(next);};
export function authenticated(req:Request,res:Response,next:NextFunction) {authenticate(String(req.cookies?.session || '')).then(user => {req.identity=user;next();}).catch(next);}
export function writers(req:Request,_res:Response,next:NextFunction) {next(req.identity.role === 'VIEWER' ? new ApiError(403,'FORBIDDEN','You do not have permission to make changes') : undefined);}
export function sameOrigin(req:Request,_res:Response,next:NextFunction) {
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && (req.get('X-Requested-With') !== 'readiness' || (req.get('Origin') && req.get('Origin') !== process.env.FRONTEND_ORIGIN))) return next(new ApiError(403,'FORBIDDEN','Request origin is not allowed'));
  next();
}
