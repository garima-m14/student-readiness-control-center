import { z } from 'zod';
import { errorSchema } from '../schemas/api';
export class ApiError extends Error { constructor(public code:string,message:string,public requestId='',public fields:Record<string,string>={}) {super(message);} }
// A generation barrier also rejects responses from transports that ignore abort.
export class RequestScope {
  private generation=0;
  private controllers=new Set<AbortController>();
  reset() {this.generation++;for(const c of this.controllers)c.abort();this.controllers.clear();}
  async request<T>(path:string,schema:z.ZodType<T>,options:RequestInit={}) {
    const generation=this.generation; const controller=new AbortController();this.controllers.add(controller);
    const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)controller.abort();
    try {
      const response=await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`,{...options,signal:controller.signal,credentials:'include',headers:{'Content-Type':'application/json','X-Requested-With':'readiness',...options.headers}});
      const body:unknown=await response.json();
      if(generation!==this.generation || controller.signal.aborted) throw new DOMException('Stale request','AbortError');
      if(!response.ok) {const error=errorSchema.safeParse(body);if(error.success)throw new ApiError(error.data.code,error.data.message,error.data.requestId,error.data.fields);throw new ApiError('NETWORK_ERROR','The service is unavailable. Please retry.');}
      return schema.parse(body);
    } finally {this.controllers.delete(controller);options.signal?.removeEventListener('abort',abort);}
  }
}
export const scope=new RequestScope();
export const api=<T>(path:string,schema:z.ZodType<T>,options?:RequestInit)=>scope.request(path,schema,options);
