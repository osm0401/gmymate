(function attachData(app) {
const profileLabels = {
  "beginner": "처음 시작",
  "under-6-months": "6개월 이하",
  "under-2-years": "2년 이하",
  "over-2-years": "2년 이상",
  "fat-loss": "체지방 감량",
  "muscle-gain": "근육 증가",
  "strength": "근력 향상",
  "habit": "운동 습관 만들기"
};

const weeklyLabels = {
  "2": "주 2회",
  "3": "주 3회",
  "4": "주 4회",
  "5": "주 5회+"
};

const onboardingRules = [
  { name: "age", label: "나이", min: 10, max: 100 },
  { name: "height", label: "키", min: 100, max: 230 },
  { name: "weight", label: "몸무게", min: 30, max: 250 },
  { name: "targetWeight", label: "목표 몸무게", min: 30, max: 250 },
  { name: "experience", label: "헬스 경력" },
  { name: "goal", label: "목표" },
  { name: "weeklyWorkout", label: "주 운동 횟수" }
];

const exerciseCatalog = [
  { id: "bench-press", name: "벤치프레스", category: "가슴", weight: 20, reps: 10, sets: 3 },
  { id: "incline-bench-press", name: "인클라인 벤치프레스", category: "가슴", weight: 20, reps: 10, sets: 3 },
  { id: "dumbbell-press", name: "덤벨프레스", category: "가슴", weight: 10, reps: 10, sets: 3 },
  { id: "chest-fly", name: "체스트 플라이", category: "가슴", weight: 20, reps: 12, sets: 3 },
  { id: "dips", name: "딥스", category: "가슴", weight: 0, reps: 8, sets: 3 },
  { id: "push-up", name: "푸시업", category: "가슴", weight: 0, reps: 15, sets: 3 },
  { id: "squat", name: "스쿼트", category: "하체", weight: 90, reps: 5, sets: 3 },
  { id: "deadlift", name: "데드리프트", category: "등/하체", weight: 80, reps: 5, sets: 3 },
  { id: "leg-press", name: "레그프레스", category: "하체", weight: 100, reps: 10, sets: 3 },
  { id: "leg-extension", name: "레그 익스텐션", category: "하체", weight: 25, reps: 12, sets: 3 },
  { id: "leg-curl", name: "레그 컬", category: "하체", weight: 25, reps: 12, sets: 3 },
  { id: "lunge", name: "런지", category: "하체", weight: 0, reps: 12, sets: 3 },
  { id: "romanian-deadlift", name: "루마니안 데드리프트", category: "하체", weight: 40, reps: 10, sets: 3 },
  { id: "hip-thrust", name: "힙 쓰러스트", category: "하체", weight: 40, reps: 10, sets: 3 },
  { id: "calf-raise", name: "카프 레이즈", category: "하체", weight: 20, reps: 15, sets: 3 },
  { id: "lat-pulldown", name: "랫풀다운", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "pull-up", name: "풀업", category: "등", weight: 0, reps: 8, sets: 3 },
  { id: "barbell-row", name: "바벨로우", category: "등", weight: 30, reps: 10, sets: 3 },
  { id: "cable-row", name: "케이블로우", category: "등", weight: 35, reps: 10, sets: 3 },
  { id: "one-arm-row", name: "원암 덤벨로우", category: "등", weight: 12, reps: 10, sets: 3 },
  { id: "face-pull", name: "페이스 풀", category: "등", weight: 15, reps: 12, sets: 3 },
  { id: "shoulder-press", name: "숄더프레스", category: "어깨", weight: 20, reps: 8, sets: 3 },
  { id: "dumbbell-shoulder-press", name: "덤벨 숄더프레스", category: "어깨", weight: 8, reps: 10, sets: 3 },
  { id: "lateral-raise", name: "사이드 레터럴 레이즈", category: "어깨", weight: 4, reps: 15, sets: 3 },
  { id: "front-raise", name: "프론트 레이즈", category: "어깨", weight: 4, reps: 12, sets: 3 },
  { id: "rear-delt-fly", name: "리어 델트 플라이", category: "어깨", weight: 10, reps: 12, sets: 3 },
  { id: "dumbbell-curl", name: "덤벨컬", category: "팔", weight: 8, reps: 12, sets: 3 },
  { id: "hammer-curl", name: "해머 컬", category: "팔", weight: 8, reps: 12, sets: 3 },
  { id: "cable-curl", name: "케이블 컬", category: "팔", weight: 15, reps: 12, sets: 3 },
  { id: "triceps-pushdown", name: "트라이셉스 푸시다운", category: "팔", weight: 15, reps: 12, sets: 3 },
  { id: "overhead-triceps", name: "오버헤드 트라이셉스", category: "팔", weight: 8, reps: 12, sets: 3 },
  { id: "plank", name: "플랭크", category: "코어", weight: 0, reps: 60, sets: 3, unit: "초" },
  { id: "crunch", name: "크런치", category: "코어", weight: 0, reps: 20, sets: 3 },
  { id: "leg-raise", name: "레그 레이즈", category: "코어", weight: 0, reps: 15, sets: 3 },
  { id: "ab-wheel", name: "AB 롤아웃", category: "코어", weight: 0, reps: 10, sets: 3 },
  { id: "russian-twist", name: "러시안 트위스트", category: "코어", weight: 0, reps: 20, sets: 3 },
  { id: "treadmill", name: "트레드밀", category: "유산소", weight: 0, reps: 20, sets: 1, unit: "분" },
  { id: "cycling", name: "사이클", category: "유산소", weight: 0, reps: 20, sets: 1, unit: "분" },
  { id: "stair-climber", name: "스텝밀", category: "유산소", weight: 0, reps: 15, sets: 1, unit: "분" },
  { id: "rowing-machine", name: "로잉 머신", category: "유산소", weight: 0, reps: 15, sets: 1, unit: "분" }
];

Object.assign(app, {
  profileLabels,
  weeklyLabels,
  onboardingRules,
  exerciseCatalog
});
})(window.Gmymate = window.Gmymate || {});
