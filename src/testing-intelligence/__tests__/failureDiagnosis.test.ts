import { describe, expect, it } from 'vitest';
import { diagnoseFailure } from '../failureDiagnosis.js';
describe('diagnoseFailure',()=>{
 it('classifies assertion failures and never recommends hiding them with retries',()=>{
  const d=diagnoseFailure({error:'UI assertion failed: expected Home but got Login',maxRetries:2,readOnly:true});
  expect(d.kind).toBe('assertion'); expect(d.retryAllowed).toBe(false); expect(d.preserveOriginalFailure).toBe(true);
 });
 it('bounds transient retries and requires safe-to-repeat opt in',()=>{
  expect(diagnoseFailure({error:'connection reset',attempt:1,maxRetries:8,readOnly:true}).maxRetries).toBe(2);
  expect(diagnoseFailure({error:'connection reset',attempt:1,maxRetries:2,readOnly:false}).retryAllowed).toBe(false);
  expect(diagnoseFailure({error:'connection reset',attempt:1,maxRetries:2,readOnly:true}).retryAllowed).toBe(true);
 });
 it('classifies missing device as environment failure',()=>{
  expect(diagnoseFailure({error:'no devices/emulators found'}).kind).toBe('environment');
 });
});
