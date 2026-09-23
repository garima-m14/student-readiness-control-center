import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Student } from '../types';
import { api, ApiError } from '../api/client';
import { detailSchema } from '../schemas/api';
import { ErrorState } from './ui';
export function EditStudent({student}:{student:Student}){const client=useQueryClient();const [busy,setBusy]=useState(false);const lock=useRef(false);const [error,setError]=useState<Error|null>(null);const [saved,setSaved]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(lock.current)return;const data=new FormData(e.currentTarget);lock.current=true;setBusy(true);setError(null);setSaved(false);try{await api(`/students/${student.id}`,detailSchema,{method:'PATCH',body:JSON.stringify({name:data.get('name'),phone:data.get('phone')||null,expectedVersion:student.version})});await client.invalidateQueries();setSaved(true);}catch(err){if(err instanceof ApiError && err.code==='CONFLICT')await client.invalidateQueries();setError(err instanceof Error?err:new Error('Unable to save'));}finally{lock.current=false;setBusy(false);}}
  return <details className="panel edit-panel"><summary>Edit student information <span>Version {student.version}</span></summary><form onSubmit={submit}><label>Name<input key={student.name} name="name" defaultValue={student.name} required maxLength={120}/></label><label>Phone<input key={student.phone} name="phone" defaultValue={student.phone??''} maxLength={30}/></label>{error&&<ErrorState error={error}/>} {saved&&<p role="status" className="success">Student information updated.</p>}<button disabled={busy} className="secondary">{busy?'Saving…':'Save changes'}</button></form></details>;
}
