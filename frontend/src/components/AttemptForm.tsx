import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { attemptResultSchema, keys } from '../schemas/api';
import { label } from '../utils/format';
import { ErrorState } from './ui';
const inputSchema=z.object({competency:z.enum(keys),score:z.coerce.number().min(0).max(100).multipleOf(0.01),attemptedAt:z.string().min(1)});
export function AttemptForm({studentId}:{studentId:string}) {
  const client=useQueryClient();const [busy,setBusy]=useState(false);const lock=useRef(false);const [error,setError]=useState<Error|null>(null);const [success,setSuccess]=useState(false);const pending=useRef<{body:string;key:string}|null>(null);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;const raw=Object.fromEntries(new FormData(e.currentTarget));const parsed=inputSchema.safeParse(raw);if(!parsed.success){setError(new ApiError('VALIDATION_ERROR',parsed.error.issues[0].message));return;}
    const body=JSON.stringify({...parsed.data,attemptedAt:new Date(parsed.data.attemptedAt).toISOString()});if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};
    lock.current=true;setBusy(true);setError(null);setSuccess(false);
    try{await api(`/students/${studentId}/attempts`,attemptResultSchema,{method:'POST',headers:{'Idempotency-Key':pending.current.key},body});pending.current=null;await client.invalidateQueries();setSuccess(true);}catch(err){if(err instanceof ApiError && ['CONFLICT','IDEMPOTENCY_CONFLICT'].includes(err.code)){await client.invalidateQueries();pending.current=null;}setError(err instanceof Error?err:new Error('Unable to save. Retry with the same values.'));}finally{lock.current=false;setBusy(false);}
  }
  return <section className="panel form-panel"><h2><Plus size={19}/> Record assessment</h2><p>Capture a new piece of competency evidence.</p><form onSubmit={submit}><label>Competency<select name="competency" disabled={busy}>{keys.map(k=><option key={k} value={k}>{label(k)}</option>)}</select></label><div className="form-row"><label>Score <span className="muted">/ 100</span><input name="score" type="number" min="0" max="100" step="0.01" required disabled={busy} placeholder="85"/></label><label>Attempted at<input name="attemptedAt" type="datetime-local" required disabled={busy} defaultValue={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}/></label></div>{error&&<><ErrorState error={error}/><p className="help">If your connection dropped, retry with the same values. Your request key is retained to prevent duplicates.</p></>}{success&&<div role="status" className="success">Assessment saved. Readiness is up to date.</div>}<button className="primary" disabled={busy}>{busy?'Saving assessment…':'Save assessment'}<Plus size={16}/></button><p className="help">Your account is recorded as the evaluator.</p></form></section>;
}
