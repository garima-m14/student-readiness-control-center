import { ApiError } from '../utils/errors.js';
export function requireActive(status:string) { if (status !== 'ACTIVE') throw new ApiError(401,'AUTH_REQUIRED','Please sign in again'); }
