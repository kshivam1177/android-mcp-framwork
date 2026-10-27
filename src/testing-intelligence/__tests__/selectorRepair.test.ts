import { describe, expect, it } from 'vitest';
import { proposeSelectorRepair } from '../selectorRepair.js';
import type { UiNode } from '../../types.js';
const node=(overrides:Partial<UiNode>={}):UiNode=>({ref:'e1',index:0,className:'android.widget.Button',text:'Continue',contentDesc:'Continue',resourceId:'com.app:id/continue_button',bounds:{left:0,top:0,right:10,bottom:10},centerX:5,centerY:5,clickable:true,enabled:true,focusable:true,scrollable:false,checkable:false,checked:false,depth:1,...overrides});
describe('proposeSelectorRepair',()=>{
 it('does not propose a repair when selector remains unique',()=>expect(proposeSelectorRepair({kind:'resourceId',value:'com.app:id/continue_button'},[node()]).status).toBe('still_matches'));
 it('proposes reviewed alternatives without mutating source selectors',()=>{
  const result=proposeSelectorRepair({kind:'text',value:'Continue now'},[node()]);
  expect(result.status).toBe('repair_candidates'); expect(result.proposals[0]?.reviewRequired).toBe(true);
 });
 it('does not guess when no similar node exists',()=>expect(proposeSelectorRepair({kind:'text',value:'Payment complete'},[node({text:'Cancel',contentDesc:'Close',resourceId:'x:y'})]).status).toBe('no_candidate'));
});
