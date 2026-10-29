// Synthetic class data only. Names are generic labels, never real students.

export function mulberry32(seed) {
  let a = seed | 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS = ['Quiz', 'Task', 'Lab', 'Essay', 'Project'];
const MAXES = [10, 20, 25, 50, 100];

export function generateDataset({ students = 200, assessments = 30, seed = 7, fillRate = 0.85 } = {}) {
  const rand = mulberry32(seed);
  const studentList = Array.from({ length: students }, (_, i) => ({
    id: `s${i + 1}`,
    name: `Student ${String(i + 1).padStart(3, '0')}`,
  }));
  const assessmentList = Array.from({ length: assessments }, (_, i) => ({
    id: `a${i + 1}`,
    title: `${KINDS[i % KINDS.length]} ${i + 1}`,
    max: MAXES[i % MAXES.length],
  }));
  const scores = studentList.map(() => {
    const ability = 0.45 + 0.5 * rand();
    return assessmentList.map((a) => {
      if (rand() > fillRate) return null;
      const p = Math.min(1, Math.max(0, ability + (rand() - 0.5) * 0.3));
      return Math.round(a.max * p);
    });
  });
  return { students: studentList, assessments: assessmentList, scores };
}
