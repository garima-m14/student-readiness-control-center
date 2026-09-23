import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, scope } from '../api/client';
import { userSchema } from '../schemas/api';
import type { User } from '../types';
interface Auth {user:User|null;loading:boolean;login:(input:{organization:string;email:string;password:string})=>Promise<void>;logout:()=>Promise<void>}
const Context=createContext<Auth|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const client=useQueryClient();
  useEffect(()=>{const controller=new AbortController();api('/auth/me',userSchema,{signal:controller.signal}).then(setUser).catch(()=>{}).finally(()=>setLoading(false));return()=>controller.abort();},[]);
  const reset=async()=>{setUser(null);scope.reset();await client.cancelQueries();client.clear();};
  const login=async(input:{organization:string;email:string;password:string})=>{await reset();const next=await api('/auth/login',userSchema,{method:'POST',body:JSON.stringify(input)});setUser(next);await client.invalidateQueries();};
  const logout=async()=>{await reset();await api('/auth/logout',z.object({ok:z.boolean()}),{method:'POST'});};
  return <Context.Provider value={{user,loading,login,logout}}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('Auth provider missing');return value;}
