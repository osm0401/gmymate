export const profileLabels = {
  "beginner": "처음 시작",
  "under-6-months": "6개월 이하",
  "under-2-years": "2년 이하",
  "over-2-years": "2년 이상",
  "fat-loss": "체지방 감량",
  "muscle-gain": "근육 증가",
  "strength": "근력 향상",
  "habit": "운동 습관 만들기"
};

export const weeklyLabels = {
  "2": "주 2회",
  "3": "주 3회",
  "4": "주 4회",
  "5": "주 5회+"
};

export const onboardingRules = [
  { name: "height", label: "키", min: 100, max: 230 },
  { name: "age", label: "나이", min: 10, max: 100 },
  { name: "weight", label: "몸무게", min: 30, max: 250 },
  { name: "targetWeight", label: "목표 몸무게", min: 30, max: 250 },
  { name: "experience", label: "헬스 경력" },
  { name: "goal", label: "목표" },
  { name: "weeklyWorkout", label: "주 운동 횟수" }
];

export const exerciseCatalog = [
  { id: "bench-press", name: "벤치프레스", category: "가슴", weight: 20, reps: 10, sets: 3 },
  { id: "squat", name: "스쿼트", category: "하체", weight: 90, reps: 5, sets: 3 },
  { id: "deadlift", name: "데드리프트", category: "등/하체", weight: 80, reps: 5, sets: 3 },
  { id: "shoulder-press", name: "숄더프레스", category: "어깨", weight: 20, reps: 8, sets: 3 },
  { id: "lat-pulldown", name: "랫풀다운", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "leg-press", name: "레그프레스", category: "하체", weight: 100, reps: 10, sets: 3 },
  { id: "dumbbell-curl", name: "덤벨컬", category: "팔", weight: 8, reps: 12, sets: 3 },
  { id: "cable-row", name: "케이블로우", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "push-up", name: "푸시업", category: "가슴", weight: 0, reps: 15, sets: 3 },
  { id: "plank", name: "플랭크", category: "코어", weight: 0, reps: 60, sets: 3 }
];
