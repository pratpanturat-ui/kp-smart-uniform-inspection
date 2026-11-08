import test from 'node:test';
import assert from 'node:assert/strict';
import { secondRoundEligible, secondRoundCandidates, inspectionProgress } from '../src/utils/inspection-flow.js';
const students=[{studentId:'1',active:true},{studentId:'2',active:true},{studentId:'3',active:false},{studentId:'4'}];
test('students marked failed or absent in round one enter round two',()=>{
 const primary={1:{status:'not_checked'},2:{status:'issue'},3:{status:'not_checked'}};
 assert.deepEqual(secondRoundCandidates(students,primary).map(s=>s.studentId),['1','2']);
 assert.equal(secondRoundEligible(undefined),false);
 assert.equal(secondRoundEligible({status:'issue'}),true);
 assert.equal(secondRoundEligible({status:'issue',resolution:'resolved'}),true);
 assert.equal(secondRoundEligible({status:'pass'}),false);
});
test('per-round counts do not conflate absence and not-yet-checked',()=>{
 assert.deepEqual(inspectionProgress(students,{1:{status:'not_checked'},2:{status:'pass'}}),{total:3,pass:1,issue:0,absent:1,uninspected:1});
});

test('second-round candidates include failed and absent students across KP Families',()=>{
 const roster=[{studentId:'01',familyId:'F01',active:true},{studentId:'02',familyId:'F02',active:true},{studentId:'03',familyId:'F03',active:true}];
 const primary={'01':{status:'not_checked'},'02':{status:'not_checked'},'03':{status:'issue'}};
 assert.deepEqual(secondRoundCandidates(roster,primary).map(s=>s.studentId),['01','02','03']);
});

test('no student without a failed/absent first-round record appears in second-round list',()=>{
 const roster=[{studentId:'01',active:true},{studentId:'02',active:true},{studentId:'03',active:true},{studentId:'04',active:true}];
 const primary={'01':{status:'issue',issueTypes:['hair']},'02':{status:'pass'},'04':{status:'not_checked'}};
 assert.deepEqual(secondRoundCandidates(roster,primary).map(s=>s.studentId),['01','04']);
});