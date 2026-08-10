// node orchestrator/test.mjs — 폴백 판정 로직 자체 점검
import assert from "node:assert";
import { isQuotaError, parseReview, repeatFlag } from "./orchestrator.mjs";

// 한도 에러만 AGY 폴백 대상
assert(isQuotaError({ status: 429, message: "Too Many Requests" }));
assert(isQuotaError(new Error("Claude usage limit reached")));
assert(isQuotaError({ status: 429 }));
assert(isQuotaError(new Error("RESOURCE_EXHAUSTED: quota exceeded")));
assert(!isQuotaError(new Error("500 internal server error")));
assert(!isQuotaError(new Error("ENOENT: claude not found")));

// 판정 파싱 — 못 읽으면 통과시키지 않는다
assert.equal(parseReview("APPROVE\n문제 없음").verdict, "APPROVE");
assert.equal(parseReview("REQUEST_CHANGES\napi 키 하드코딩").verdict, "REQUEST_CHANGES");
assert.equal(parseReview("REQUEST CHANGES: 테스트 없음").verdict, "REQUEST_CHANGES");
assert.equal(parseReview("판정 없는 잡담").verdict, "REQUEST_CHANGES");
// 판정을 못 읽은 경우는 반려와 구분돼야 한다 — reviewer()가 이걸 보고 재시도한다
assert.equal(parseReview("판정 없는 잡담").found, false);
assert.equal(parseReview("jetski: no output produced — a tool required permission").found, false);
assert.equal(parseReview("APPROVE\n문제 없음").found, true);
assert.equal(parseReview("REQUEST_CHANGES\n테스트 없음").found, true);
// APPROVE가 뒤에 섞여 나와도 첫 판정을 따른다
assert.equal(parseReview("REQUEST_CHANGES\n수정하면 APPROVE 가능").verdict, "REQUEST_CHANGES");

// 같은 지적 3회째에만 플래그가 한 번 뜬다
const same = "src/a.js:10 — 시크릿 하드코딩";
assert.equal(repeatFlag([same, same]).length, 0);
assert.equal(repeatFlag([same, same, same]).length, 1);
assert.equal(repeatFlag([same, same, same, same]).length, 1);
assert.equal(repeatFlag([same, "다른 지적", same]).length, 0);

console.log("ok");
