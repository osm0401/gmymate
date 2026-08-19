import { exerciseCatalog } from "./data.js";

const GUIDE_COPY = {
  "seated-row": {
    target: "등 중앙과 광배근",
    cues: ["가슴을 세우고 손잡이를 배꼽 쪽으로 당긴다", "팔보다 팔꿈치를 뒤로 보낸다"],
    caution: "허리를 젖히거나 반동으로 당기지 않는다."
  },
  "lat-pulldown": {
    target: "광배근과 등 상부",
    cues: ["가슴을 살짝 들고 바를 쇄골 쪽으로 당긴다", "어깨를 내린 채 팔꿈치를 아래로 보낸다"],
    caution: "바를 목 뒤로 내리거나 몸을 크게 젖히지 않는다."
  },
  "wide-pulldown": {
    target: "광배근과 등 상부",
    cues: ["어깨보다 넓게 잡고 가슴을 세운다", "팔꿈치를 옆구리 아래로 끌어내린다"],
    caution: "손목을 꺾거나 반동으로 바를 내리지 않는다."
  },
  "seated-multi-high-row": {
    target: "등 상부와 후면 어깨",
    cues: ["가슴을 패드에 붙이고 상체를 고정한다", "팔꿈치를 바깥 뒤쪽으로 당긴다"],
    caution: "어깨가 귀 쪽으로 올라가지 않게 한다."
  },
  squat: {
    target: "허벅지와 엉덩이",
    cues: ["발바닥 전체로 바닥을 민다", "무릎과 발끝을 같은 방향으로 보낸다"],
    caution: "허리가 둥글게 말리거나 무릎이 안쪽으로 모이지 않게 한다."
  },
  "hack-squat": {
    target: "허벅지 앞쪽과 엉덩이",
    cues: ["등과 골반을 패드에 붙인다", "발뒤꿈치로 밀며 무릎을 편다"],
    caution: "무릎을 잠그거나 엉덩이가 패드에서 뜨지 않게 한다."
  },
  "leg-press": {
    target: "허벅지와 엉덩이",
    cues: ["발을 플랫폼에 안정적으로 둔다", "무릎을 발끝 방향으로 굽혔다 민다"],
    caution: "골반이 말릴 만큼 깊게 내리거나 무릎을 잠그지 않는다."
  },
  "seated-leg-press": {
    target: "허벅지와 엉덩이",
    cues: ["허리와 엉덩이를 등받이에 붙인다", "발뒤꿈치까지 힘을 실어 민다"],
    caution: "무릎이 안쪽으로 모이거나 끝에서 잠기지 않게 한다."
  },
  cycle: {
    target: "심폐 체력과 하체 지구력",
    cues: ["무릎이 살짝 굽는 높이로 안장을 맞춘다", "상체 힘을 빼고 일정한 리듬을 유지한다"],
    caution: "저항을 갑자기 높이거나 페달에서 발이 뜨지 않게 한다."
  },
  "overhead-extension": {
    target: "위팔 뒤쪽 삼두근",
    cues: ["팔꿈치를 머리 옆에 고정한다", "팔꿈치만 펴며 무게를 올린다"],
    caution: "허리를 과하게 젖히거나 팔꿈치가 벌어지지 않게 한다."
  },
  "arm-curl": {
    target: "위팔 앞쪽 이두근",
    cues: ["팔꿈치를 몸통 옆에 고정한다", "손목을 곧게 두고 천천히 내린다"],
    caution: "상체 반동으로 무게를 올리지 않는다."
  },
  "shoulder-press": {
    target: "어깨와 삼두근",
    cues: ["가슴을 세우고 손목을 팔꿈치 위에 둔다", "머리 위로 부드럽게 밀어 올린다"],
    caution: "허리를 과하게 젖히거나 팔꿈치를 잠그지 않는다."
  },
  "dumbbell-front-raise": {
    target: "어깨 앞쪽",
    cues: ["팔꿈치를 살짝 굽힌 채 덤벨을 든다", "어깨 높이까지만 천천히 올린다"],
    caution: "몸을 흔들거나 어깨를 으쓱하지 않는다."
  },
  "t-bar-row": {
    target: "등 중앙과 광배근",
    cues: ["척추를 곧게 두고 엉덩이를 뒤로 뺀다", "손잡이를 명치 아래로 당긴다"],
    caution: "허리가 둥글게 말리거나 상체 반동이 생기지 않게 한다."
  },
  "chest-press": {
    target: "가슴과 삼두근",
    cues: ["어깨뼈를 등받이에 안정시킨다", "손잡이를 가슴 앞에서 곧게 민다"],
    caution: "어깨가 앞으로 말리거나 팔꿈치를 잠그지 않는다."
  },
  "incline-chest-press": {
    target: "윗가슴과 어깨 앞쪽",
    cues: ["가슴을 들고 어깨뼈를 뒤로 모은다", "손잡이를 위쪽 사선으로 민다"],
    caution: "손목이 꺾이거나 어깨가 들리지 않게 한다."
  },
  sasre: {
    target: "어깨 옆쪽",
    cues: ["팔꿈치를 살짝 굽히고 옆으로 든다", "팔꿈치가 손보다 먼저 움직이게 한다"],
    caution: "반동을 쓰거나 어깨 높이보다 과하게 들지 않는다."
  },
  "pull-up": {
    target: "광배근과 등 상부",
    cues: ["어깨를 내리고 몸통을 단단히 고정한다", "가슴을 바 쪽으로 끌어올린다"],
    caution: "목을 빼거나 몸을 크게 흔들지 않는다."
  },
  "pec-deck-fly": {
    target: "가슴",
    cues: ["등을 패드에 붙이고 가슴을 편다", "팔꿈치 각도를 유지하며 팔을 모은다"],
    caution: "팔을 과하게 뒤로 보내거나 어깨가 앞으로 말리지 않게 한다."
  },
  "reverse-pec-deck-fly": {
    target: "후면 어깨와 등 상부",
    cues: ["가슴을 패드에 붙이고 목을 길게 둔다", "팔꿈치로 양옆을 벌린다"],
    caution: "허리를 젖히거나 어깨를 으쓱하지 않는다."
  },
  "hip-extension": {
    target: "엉덩이와 허벅지 뒤쪽",
    cues: ["몸통을 고정하고 엉덩이에 힘을 준다", "다리를 뒤로 보내되 허리는 그대로 둔다"],
    caution: "허리를 꺾어 가동 범위를 늘리지 않는다."
  },
  "incline-rotation": {
    target: "복부와 옆구리",
    cues: ["갈비뼈와 골반 사이를 단단히 잡는다", "작은 범위에서 몸통을 천천히 돌린다"],
    caution: "반동으로 비틀거나 허리를 과하게 돌리지 않는다."
  },
  "row-row": {
    target: "등 중앙과 광배근",
    cues: ["가슴을 세우고 어깨를 아래로 둔다", "팔꿈치를 몸통 가까이 뒤로 당긴다"],
    caution: "몸통을 앞뒤로 흔들며 당기지 않는다."
  },
  "kneeling-crunch": {
    target: "복부",
    cues: ["골반을 고정하고 갈비뼈를 아래로 말아 내린다", "팔이 아니라 복부로 몸통을 접는다"],
    caution: "엉덩이를 뒤로 빼거나 목을 손으로 당기지 않는다."
  },
  "high-row": {
    target: "등 상부와 광배근",
    cues: ["가슴을 세우고 어깨를 내린다", "팔꿈치를 뒤쪽 아래로 당긴다"],
    caution: "허리를 젖히거나 손목을 과하게 꺾지 않는다."
  },
  fly: {
    target: "가슴",
    cues: ["어깨뼈를 뒤로 모으고 가슴을 편다", "팔꿈치 각도를 유지하며 양팔을 모은다"],
    caution: "무게를 과하게 늘리거나 팔을 너무 뒤로 보내지 않는다."
  }
};

export const exerciseGuides = Object.freeze(exerciseCatalog.map((exercise) => {
  const guide = GUIDE_COPY[exercise.id];
  return Object.freeze({
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    target: guide.target,
    cues: Object.freeze([...guide.cues]),
    caution: guide.caution
  });
}));

export function getExerciseGuide(exerciseId) {
  if (typeof exerciseId !== "string") {
    return null;
  }

  return exerciseGuides.find((guide) => guide.id === exerciseId.trim()) || null;
}

export function searchExerciseGuides(query) {
  if (typeof query !== "string") {
    return Object.freeze([]);
  }

  const keyword = query.trim().toLocaleLowerCase("ko-KR");

  if (!keyword) {
    return Object.freeze([...exerciseGuides]);
  }

  return Object.freeze(exerciseGuides.filter((guide) => [
    guide.id,
    guide.name,
    guide.category,
    guide.target,
    ...guide.cues,
    guide.caution
  ].join(" ").toLocaleLowerCase("ko-KR").includes(keyword)));
}
