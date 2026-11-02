import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where,
  setDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { inspectionId } from '../utils/domain';

export function watchCollection(name, clauses, callback, onError) {
  return onSnapshot(clauses.length ? query(collection(db, name), ...clauses) : collection(db, name),
    snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
}
export async function getFamilyDocuments(ids) {
  const snapshots = await Promise.all(ids.map(id => getDoc(doc(db, 'families', id))));
  return snapshots.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));
}
export function inspectionQuery(profile, roundId, familyId) {
  if (!roundId) return null;
  return profile.role === 'admin' && !familyId
    ? [where('roundId', '==', roundId)]
    : [where('familyId', '==', familyId), where('roundId', '==', roundId)];
}
export async function saveInspection({ user, roundId, student, old, status, issueTypes = [], note = '', resolution = 'none' }) {
  const key = inspectionId(roundId, student.studentId);
  const recordRef = doc(db, 'inspections', key);
  const eventRef = doc(collection(db, 'inspection_events'));
  const now = serverTimestamp();
  const record = {
    roundId, studentId: student.studentId, familyId: student.familyId,
    status, issueTypes: status === 'issue' ? issueTypes : [], note: note.trim().slice(0, 500),
    resolution: status === 'issue' ? resolution : 'none',
    createdBy: old?.createdBy || user.uid, createdAt: old?.createdAt || now,
    updatedBy: user.uid, updatedAt: now,
  };
  const batch = writeBatch(db);
  if (old) {
    // Explicit update preserves immutable createdAt and createdBy.
    batch.update(recordRef, {
      status: record.status, issueTypes: record.issueTypes, note: record.note,
      resolution: record.resolution, updatedBy: record.updatedBy, updatedAt: now,
    });
  } else batch.set(recordRef, record);
  batch.set(eventRef, {
    inspectionId: key, roundId, studentId: student.studentId, familyId: student.familyId,
    actorUid: user.uid, status: record.status, resolution: record.resolution,
    issueTypes: record.issueTypes, note: record.note, createdAt: now,
  });
  await batch.commit();
}
export async function updateFamily(familyId, name, active = true) {
  await setDoc(doc(db, 'families', familyId), { name: name.trim(), active });
}
export async function updateRound(roundId, name, date, status = 'open') {
  await setDoc(doc(db, 'inspection_rounds', roundId), { name: name.trim(), date, status });
}
export async function updateTeacher(uid, user) {
  await setDoc(doc(db, 'users', uid.trim()), {
    name: user.name.trim(), email: user.email.trim(), role: 'teacher',
    active: Boolean(user.active), familyIds: user.familyIds,
  });
}
export async function upsertStudents(rows, onProgress) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += 250) chunks.push(rows.slice(i, i + 250));
  let done = 0;
  for (const items of chunks) {
    const batch = writeBatch(db);
    for (const s of items) {
      batch.set(doc(db, 'students', s.studentId), {
        studentId: s.studentId, name: s.name, room: s.room, familyId: s.familyId,
      });
    }
    await batch.commit();
    done += items.length;
    onProgress?.(done, rows.length);
  }
}
export async function loadInspectorsForRound(roundId) {
  const s = await getDocs(query(collection(db, 'inspections'), where('roundId', '==', roundId)));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}