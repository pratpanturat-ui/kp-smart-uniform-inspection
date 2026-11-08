/** Select only the teacher's existing Firebase-assigned families on legacy rules. */
export function assignedFamilyFallbackIds(profile, error) {
  if (error?.code !== 'permission-denied' || profile?.role !== 'teacher') return [];
  return [...new Set((Array.isArray(profile.familyIds) ? profile.familyIds : [])
    .filter(id => typeof id === 'string' && /^F(?:0[1-9]|1[0-9]|2[01])$/.test(id)))];
}