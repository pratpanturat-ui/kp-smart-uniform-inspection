/** Month-specific second-round eligibility. Round two never replaces round-one records. */
export function secondRoundEligible(primary) {
  return primary?.status === 'not_checked';
}
export function secondRoundCandidates(students, primaryByStudent) {
  return students.filter(s => s.active !== false && secondRoundEligible(primaryByStudent[s.studentId]));
}
export function inspectionProgress(students, records = {}) {
  const list = students.filter(s => s.active !== false);
  const counts = { total: list.length, pass: 0, issue: 0, absent: 0, uninspected: 0 };
  for (const s of list) {
    const status = records[s.studentId]?.status;
    if (status === 'pass') counts.pass++;
    else if (status === 'issue') counts.issue++;
    else if (status === 'not_checked') counts.absent++;
    else counts.uninspected++;
  }
  return counts;
}