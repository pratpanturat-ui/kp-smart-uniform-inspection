// Official KP Family names prepared from family_lists_v3(2).xlsx (02 Nov 2026).
// Only non-sensitive family labels are included. Student rosters stay out of GitHub.
export const OFFICIAL_FAMILIES = Object.freeze(
  [
  {
    "id": "F01",
    "name": "เพ็ชรคล้าย"
  },
  {
    "id": "F02",
    "name": "หล้าหลัน"
  },
  {
    "id": "F03",
    "name": "ดำฤทธิ์"
  },
  {
    "id": "F04",
    "name": "คูวิบูลย์ศิลป์"
  },
  {
    "id": "F05",
    "name": "ทองธวัช"
  },
  {
    "id": "F06",
    "name": "ชูโชนาค"
  },
  {
    "id": "F07",
    "name": "มีแก้ว"
  },
  {
    "id": "F08",
    "name": "นางาม"
  },
  {
    "id": "F09",
    "name": "ชัยฤกษ์"
  },
  {
    "id": "F10",
    "name": "อุมา"
  },
  {
    "id": "F11",
    "name": "ปานจันทร์"
  },
  {
    "id": "F12",
    "name": "ทองคำ"
  },
  {
    "id": "F13",
    "name": "วิชาดี"
  },
  {
    "id": "F14",
    "name": "สนทะมิโน"
  },
  {
    "id": "F15",
    "name": "ประทุมชาติภักดี"
  },
  {
    "id": "F16",
    "name": "บุญสิทธิ์"
  },
  {
    "id": "F17",
    "name": "สตารัตน์"
  },
  {
    "id": "F18",
    "name": "พันธุรัตน์"
  },
  {
    "id": "F19",
    "name": "บุญกุศล"
  },
  {
    "id": "F20",
    "name": "ปรีชาชาญ"
  },
  {
    "id": "F21",
    "name": "สายวิจิตรธิขัติ"
  }
]
);

export function missingOrPlaceholderFamilies(existing, official = OFFICIAL_FAMILIES) {
  const byId = new Map(existing.map(f => [f.id, f]));
  return official.filter(f => {
    const old = byId.get(f.id);
    return !old || old.name === `ครอบครัว ${f.id}`;
  });
}