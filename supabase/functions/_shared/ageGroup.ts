export const AGE_GROUPS = [
  "年中以下",
  "年長",
  "小学校低学年",
  "小学校高学年",
  "中学生以上",
] as const;

export type AgeGroup = typeof AGE_GROUPS[number];

export const GRADES = [
  "年少",
  "年中",
  "年長",
  "小学校1年",
  "小学校2年",
  "小学校3年",
  "小学校4年",
  "小学校5年",
  "小学校6年",
  "中学生",
] as const;

export type Grade = typeof GRADES[number];

const GRADE_TO_AGE_GROUP: Record<Grade, AgeGroup> = {
  "年少": "年中以下",
  "年中": "年中以下",
  "年長": "年長",
  "小学校1年": "小学校低学年",
  "小学校2年": "小学校低学年",
  "小学校3年": "小学校低学年",
  "小学校4年": "小学校高学年",
  "小学校5年": "小学校高学年",
  "小学校6年": "小学校高学年",
  "中学生": "中学生以上",
};

export function isValidGrade(grade: string): grade is Grade {
  return (GRADES as readonly string[]).includes(grade);
}

export function gradeToAgeGroup(grade: string): AgeGroup | null {
  return isValidGrade(grade) ? GRADE_TO_AGE_GROUP[grade] : null;
}

// 上位学年は下位学年のイラストも全て出題対象になるため、
// 対象age_group以下(自分の学年群を含む)を累積で返す。
export function cumulativeAgeGroups(ageGroup: AgeGroup): AgeGroup[] {
  const idx = AGE_GROUPS.indexOf(ageGroup);
  return AGE_GROUPS.slice(0, idx + 1);
}
