import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where,
  setDoc, updateDoc, serverTimestamp, writeBatch, runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { inspectionId } from '../utils/domain';
import { OFFICIAL_FAMILIES } from '../data/family-config';
import { assignedFamilyFallbackIds } from '../utils/roster-access';

export function watchCollection(name, clauses, callback, onError) {
  return onSnapshot(clauses.length ? query(collection(db, name), ...clauses) : collection(db, name),
    snapshot => callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
}
/**
 * Load the full school roster on the newest Firestore rules.
 * If the server still has the older per-family rules, show the teacher's
 * assigned-family roster as a temporary fallback and surface the permission
 * warning; never portray it as the entire school's data.
 */
export function watchStudentRoster(profile, onRows, onProblem) {
  let disposed = false;
  const fallbackUnsubs = [];
  const unsubscribe = watchCollection('students', [], rows => {
    if (disposed) return;
    onRows(rows);
    onProblem(null);
  }, error => {
    if (disposed) return;
    const familyIds = assignedFamilyFallbackIds(profile, error);
    if (!familyIds.length) {
      onRows([]);
      onProblem({ code: error?.code || 'unknown', scope: 'none' });
      return;
    }
    // The production rules are not yet updated. A query constrained to one
    // familyId is valid under legacy memberOf(resource.data.familyId) rules.
    onProblem({ code: 'permission-denied', scope: 'assigned-families' });
    const familyRows = new Map();
    familyIds.forEach(familyId => {
      const stop = watchCollection('students', [where('familyId', '==', familyId)], rows => {
        if (disposed) return;
        familyRows.set(familyId, rows);
        const combined = new Map();
        for (const group of familyRows.values()) for (const row of group)
          combined.set(row.studentId || row.id, row);
        onRows([...combined.values()]);
      }, fallbackError => {
        if (disposed) return;
        onProblem({ code: fallbackError?.code || 'unknown', scope: 'none' });
      });
      fallbackUnsubs.push(stop);
    });
  });
  return () => {
    disposed = true;
    unsubscribe();
    fallbackUnsubs.forEach(stop => stop());
  };
}

export async function getFamilyDocuments(ids) {
  const snapshots = await Promise.all(ids.map(id => getDoc(doc(db, 'families', id))));
  return snapshots.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() }));
}
export function inspectionQuery(roundId) {
  // Every active staff member can inspect all 21 families. One field avoids
  // the composite indexes that previously made teacher round-two lists blank.
  return roundId ? [where('roundId', '==', roundId)] : [];
}
export async function saveInspection({ user, roundId, student, old, status, issueTypes = [], note = '', resolution = 'none', phase = 1 }) {
  const key = inspectionId(roundId, student.studentId);
  const recordRef = doc(db, phase === 2 ? 'inspection_round2' : 'inspections', key);
  const eventRef = doc(collection(db, phase === 2 ? 'inspection_round2_events' : 'inspection_events'));
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
/**
 * Idempotent initialization for the 21 official KP Family labels.
 * Invoked only AFTER the ADMIN has authenticated and the families listener succeeds.
 * Creates missing entries and replaces only generated placeholders. Never overwrites
 * an existing custom name or active flag. Transactions protect concurrent sessions.
 * Split into groups of seven to avoid large batched permission-rule checks.
 */
export async function ensureOfficialFamilies(families = OFFICIAL_FAMILIES) {
  let created = 0;
  let renamedPlaceholders = 0;
  for (let offset = 0; offset < families.length; offset += 7) {
    const chunk = families.slice(offset, offset + 7);
    const result = await runTransaction(db, async transaction => {
      // Firestore transactions require ALL reads before writes.
      const documents = await Promise.all(chunk.map(f => transaction.get(doc(db, 'families', f.id))));
      let added = 0;
      let updated = 0;
      for (let i = 0; i < chunk.length; i++) {
        const family = chunk[i];
        const snapshot = documents[i];
        const ref = doc(db, 'families', family.id);
        if (!snapshot.exists()) {
          transaction.set(ref, { name: family.name, active: true });
          added++;
        } else if (snapshot.data().name === `ครอบครัว ${family.id}`) {
          transaction.update(ref, { name: family.name });
          updated++;
        }
      }
      return { added, updated };
    });
    created += result.added;
    renamedPlaceholders += result.updated;
  }
  return { created, renamedPlaceholders };
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
    ...(user.username ? { username: user.username.trim().toLowerCase() } : {}),
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

/** Active staff may create/update student information, enforced in firestore.rules.
 * Historical inspections remain linked to the immutable studentId.
 */
export async function saveStudent(student, active = true) {
  await setDoc(doc(db, 'students', student.studentId), {
    studentId: student.studentId, name: student.name.trim(),
    room: student.room.trim(), familyId: student.familyId,
    active: Boolean(active),
  });
}
/** Logical deletion: hide from inspection lists without destroying history. */
export async function setStudentActive(studentId, active) {
  await updateDoc(doc(db, 'students', studentId), { active: Boolean(active) });
}