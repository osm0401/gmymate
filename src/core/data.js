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
  { id: "seated-row", name: "시티드 로우", category: "등", weight: 40, reps: 10, sets: 3 },
  { id: "lat-pulldown", name: "렛풀다운", category: "등", weight: 40, reps: 10, sets: 3 },
  { id: "wide-pulldown", name: "와이드풀다운", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "seated-multi-high-row", name: "시티드 멀티 하이로우", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "squat", name: "스쿼트", category: "하체", weight: 40, reps: 8, sets: 4 },
  { id: "hack-squat", name: "핵스쿼트", category: "하체", weight: 60, reps: 10, sets: 3 },
  { id: "leg-press", name: "레그프레스", category: "하체", weight: 100, reps: 10, sets: 3 },
  { id: "seated-leg-press", name: "시티드 레그프레스", category: "하체", weight: 80, reps: 10, sets: 3 },
  { id: "cycle", name: "사이클", category: "유산소", weight: 0, reps: 20, sets: 1 },
  { id: "overhead-extension", name: "오버헤드 익스텐션", category: "팔", weight: 15, reps: 12, sets: 3 },
  { id: "arm-curl", name: "암컬", category: "팔", weight: 10, reps: 12, sets: 3 },
  { id: "shoulder-press", name: "숄더프레스", category: "어깨", weight: 20, reps: 8, sets: 3 },
  { id: "dumbbell-front-raise", name: "덤벨 프론트 레이즈", category: "어깨", weight: 5, reps: 12, sets: 3 },
  { id: "t-bar-row", name: "타바로우", category: "등", weight: 30, reps: 10, sets: 3 },
  { id: "chest-press", name: "체스트프레스", category: "가슴", weight: 30, reps: 10, sets: 3 },
  { id: "incline-chest-press", name: "인클라인 체스트프레스", category: "가슴", weight: 25, reps: 10, sets: 3 },
  { id: "sasre", name: "사스레", category: "기타", weight: 10, reps: 12, sets: 3 },
  { id: "pull-up", name: "풀업", category: "등", weight: 0, reps: 8, sets: 3 },
  { id: "pec-deck-fly", name: "펙덱플라이", category: "가슴", weight: 25, reps: 12, sets: 3 },
  { id: "reverse-pec-deck-fly", name: "리버스 펙덱플라이", category: "어깨", weight: 20, reps: 12, sets: 3 },
  { id: "hip-extension", name: "힙 익스텐션", category: "하체", weight: 15, reps: 12, sets: 3 },
  { id: "incline-rotation", name: "인클라인 로테이션", category: "코어", weight: 10, reps: 15, sets: 3 },
  { id: "row-row", name: "로우로우", category: "등", weight: 30, reps: 10, sets: 3 },
  { id: "kneeling-crunch", name: "닐링 크런치", category: "코어", weight: 0, reps: 15, sets: 3 },
  { id: "high-row", name: "하이로우", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "fly", name: "플라이", category: "가슴", weight: 15, reps: 12, sets: 3 }
];
