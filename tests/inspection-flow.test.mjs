import test from 'node:test';
import assert from 'node:assert/strict';
import { secondRoundEligible, secondRoundCandidates, inspectionProgress } from '../src/utils/inspection-flow.js';
const students=[{studentId:'1',active:true},{studentId:'2',active:true},{studentId:'3',active:false},{studentId:'4'}];
test('only explicitly marked absent in round one enter round two',()=>{
 const primary={1:{status:'not_checked'},2:{status:'pass'},3:{status:'not_checked'}};
 assert.deepEqual(secondRoundCandidates(students,primary).map(s=>s.studentId),['1']);
 assert.equal(secondRoundEligible(undefined),false);
 assert.equal(secondRoundEligible({status:'issue'}),false);
});
test('per-round counts do not conflate absence and not-yet-checked',()=>{
 assert.deepEqual(inspectionProgress(students,{1:{status:'not_checked'},2:{status:'pass'}}),{total:3,pass:1,issue:0,absent:1,uninspected:1});
});