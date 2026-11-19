/** Round two covers first-round failures and absence, without overwriting first-round records. */
export function secondRoundEligible(primary) {
  return primary?.status === 'not_checked' || primary?.status === 'issue';
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

/** Final monthly inspection only includes students still failed/absent in round two. */
export function finalRoundEligible(second) {
  return second?.status === 'issue' || second?.status === 'not_checked';
}
export function finalRoundCandidates(students, secondByStudent) {
  return students.filter(s => s.active !== false && finalRoundEligible(secondByStudent[s.studentId]));
}

/** Existing inspection_rounds document IDs are the month identifiers (YYYY-MM). */
export function thaiMonthLabel(monthId) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthId || '')) return monthId || 'ไม่ระบุเดือน';
  const [year, month] = monthId.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', {month: 'long', year: 'numeric', timeZone: 'UTC'})
    .format(new Date(Date.UTC(year, month - 1, 1)));
}