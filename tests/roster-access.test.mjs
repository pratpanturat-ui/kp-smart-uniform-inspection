import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedFamilyFallbackIds} from '../src/utils/roster-access.js';

test('old rules: teacher can temporarily see only assigned families',()=>{
 assert.deepEqual(assignedFamilyFallbackIds({role:'teacher',familyIds:['F18','F18','F01','bad','F22']},{code:'permission-denied'}),['F18','F01']);
});
test('successful reads and admin reads never use family-scoped fallback',()=>{
 assert.deepEqual(assignedFamilyFallbackIds({role:'teacher',familyIds:['F01']},null),[]);
 assert.deepEqual(assignedFamilyFallbackIds({role:'admin',familyIds:['F01']},{code:'permission-denied'}),[]);
 assert.deepEqual(assignedFamilyFallbackIds({role:'teacher',familyIds:['F01']},{code:'unavailable'}),[]);
});
test('missing teacher family assignments cannot expand Firestore access',()=>{
 assert.deepEqual(assignedFamilyFallbackIds({role:'teacher'},{code:'permission-denied'}),[]);
});