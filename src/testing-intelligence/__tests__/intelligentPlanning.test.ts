import { describe, expect, it } from 'vitest';
import { buildIntelligentPlan } from '../intelligentPlanning.js';
describe('buildIntelligentPlan',()=>{
 it('prioritizes explicitly mapped changed files and prior failures',()=>{
  const plan=buildIntelligentPlan({request:'checkout flow',changedFiles:[{status:'modified',path:'lib/checkout.dart'}],testCases:[{id:'checkout',title:'Checkout flow',relatedFiles:['lib/checkout.dart'],steps:[]},{id:'profile',title:'Profile screen'}],priorFailures:[{testCaseId:'checkout',error:'assertion failed'}]});
  expect(plan.selected[0]?.id).toBe('checkout'); expect(plan.unmappedChangedFiles).toEqual([]); expect(plan.executesTests).toBe(false);
 });
 it('recommends broad regression for unmapped files and empty coverage',()=>{
  const plan=buildIntelligentPlan({request:'checkout',changedFiles:[{status:'modified',path:'lib/new_feature.dart'}],testCases:[]});
  expect(plan.status).toBe('needs_coverage'); expect(plan.broadRegressionRecommended).toBe(true); expect(plan.unmappedChangedFiles).toContain('lib/new_feature.dart');
 });
 it('only surfaces instructions relevant to request or changed paths',()=>{
  const plan=buildIntelligentPlan({request:'login screen',changedFiles:[],testCases:[],instructions:['Login should use test account','Checkout requires a cart']});
  expect(plan.relevantInstructions).toContain('Login should use test account'); expect(plan.relevantInstructions).not.toContain('Checkout requires a cart');
 });
});
