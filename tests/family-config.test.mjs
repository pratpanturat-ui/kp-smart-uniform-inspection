import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICIAL_FAMILIES, missingOrPlaceholderFamilies } from '../src/data/family-config.js';

test('21 official KP families, stable IDs and F13 name', () => {
  assert.equal(OFFICIAL_FAMILIES.length, 21);
  assert.deepEqual(OFFICIAL_FAMILIES.map(x => x.id), Array.from({length:21},(_,i)=>`F${String(i+1).padStart(2,'0')}`));
  assert.equal(OFFICIAL_FAMILIES[12].name, 'วิชาดี');
  assert.equal(new Set(OFFICIAL_FAMILIES.map(x=>x.id)).size,21);
});
test('only missing and placeholders are imported',()=>{
  const existing=[{id:'F01',name:'ชื่อที่แก้เอง'},{id:'F02',name:'ครอบครัว F02'},{id:'F13',name:'วิชาดี'}];
  const incoming=missingOrPlaceholderFamilies(existing);
  assert.equal(incoming.length, 19);
  assert.equal(incoming.some(x=>x.id==='F01'),false);
  assert.equal(incoming.some(x=>x.id==='F13'),false);
  assert.equal(incoming.some(x=>x.id==='F02'),true);
});
test('nothing to seed if all IDs have existing non-placeholder names',()=>{
  assert.deepEqual(missingOrPlaceholderFamilies(OFFICIAL_FAMILIES), []);
});