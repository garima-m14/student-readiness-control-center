import { describe,it,expect } from 'vitest';
import { calculateReadiness, type Evidence } from '../src/readiness/domain.js';
import { weights } from '../src/competencies/catalog.js';
const evidence=(score:number):Evidence[]=>Object.keys(weights).map((competencyId,i)=>({id:String(i),competencyId,score,attemptedAt:new Date('2026-01-01'),voidedAt:null}));
describe('readiness domain',()=>{
  it('weights sum to exactly 100',()=>expect(Object.values(weights).reduce((a,b)=>a+b,0)).toBe(100));
  it.each([[79.99,'NEARLY_READY'],[80,'READY'],[64.99,'DEVELOPING'],[65,'NEARLY_READY'],[49.99,'NEEDS_PREPARATION'],[50,'DEVELOPING'],[0,'NEEDS_PREPARATION'],[100,'READY']] as const)('classifies exact score %s as %s',(score,status)=>{const result=calculateReadiness(evidence(score));expect(result.score).toBe(score);expect(result.status).toBe(status);});
  it('computes unequal weighted scores',()=>{const a=evidence(0);a[0].score=100;a[1].score=80;a[2].score=60;a[3].score=40;expect(calculateReadiness(a).score).toBe(75);});
  it.each([1,2,4])('marks %i missing competencies incomplete',count=>{const r=calculateReadiness(evidence(100).slice(count));expect(r.status).toBe('INCOMPLETE');expect(r.missing).toHaveLength(count);});
  it('uses latest non-voided attempt and retains older valid evidence',()=>{const a=evidence(80);a.push({...a[0],id:'new',score:10,attemptedAt:new Date('2026-02-01')},{...a[0],id:'void',score:100,attemptedAt:new Date('2026-03-01'),voidedAt:new Date()});expect(calculateReadiness(a).competencies[0].score).toBe(10);});
  it('breaks equal timestamps by descending ID, independent of input order',()=>{const a=evidence(80);const b={...a[0],id:'zz',score:95};expect(calculateReadiness([...a,b]).competencies[0].latest?.id).toBe('zz');expect(calculateReadiness([b,...a]).competencies[0].latest?.id).toBe('zz');});
  it('does not mutate evidence',()=>{const a=evidence(80);const before=structuredClone(a);calculateReadiness(a);expect(a).toEqual(before);});
});
