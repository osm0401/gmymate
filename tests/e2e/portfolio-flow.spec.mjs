import { expect, test } from "@playwright/test";

test("mobile portfolio flow and cached demo work offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "샘플 데이터로 체험하기" }).click();

  await expect(page).toHaveURL(/main\.html/);
  await expect(page.getByRole("heading", { name: "운동 분석" })).toBeVisible();
  await expect(page.locator("#analyticsSessions")).not.toHaveText("0회");

  await page.getByRole("button", { name: "루틴", exact: true }).click();
  await page.locator("#exerciseGuideSearch").fill("체스트프레스");
  await page.getByRole("button", { name: /체스트프레스/ }).first().click();
  await expect(page.locator("#exerciseGuideDialog")).toBeVisible();
  await page.getByRole("button", { name: "운동 가이드 닫기" }).click();

  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page.locator("#aiChatPanel")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#aiChatMessages")).toContainText("샘플 모드");
  await page.getByRole("button", { name: "AI 채팅 닫기" }).click();

  await page.getByRole("button", { name: "내정보", exact: true }).click();
  await page.getByRole("button", { name: "계정과 데이터 삭제" }).click();
  await expect(page.locator("#deleteAccountDialog")).toBeVisible();
  await expect(page.locator("[data-delete-password-field]")).toBeHidden();
  await page.getByRole("button", { name: "취소" }).click();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("오늘 할 일만 쉽게 볼게요.")).toBeVisible();
});

test("fixed mobile controls remain inside the viewport", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "샘플 데이터로 체험하기" }).click();
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await page.waitForTimeout(250);

  for (const selector of [".ai-chat-header", ".ai-chat-prompts", ".ai-chat-composer", ".ai-chat-note"]) {
    const element = page.locator(selector);
    const box = await element.boundingBox();
    expect(box, `${selector} should be rendered`).not.toBeNull();
    expect(box.y, `${selector} should start on screen`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${selector} should end on screen`).toBeLessThanOrEqual(page.viewportSize().height);
  }

  const navBox = await page.locator(".bottom-nav").boundingBox();
  const timerBox = await page.locator(".rest-timer-card").boundingBox();
  expect(timerBox.y + timerBox.height).toBeLessThanOrEqual(navBox.y + 2);
});

test("recovery check-in and exercise replacement update real app state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "샘플 데이터로 체험하기" }).click();

  await expect(page.locator("#recoveryScore")).toHaveText("80점");
  await page.getByText("오늘 상태 입력·수정", { exact: true }).click();
  await page.getByLabel("수면 만족도").fill("5");
  await page.getByRole("button", { name: "회복 상태 저장" }).click();
  await expect(page.locator("#recoveryScore")).toHaveText("87점");

  await page.getByRole("button", { name: "기록", exact: true }).click();
  await page.getByRole("button", { name: "운동 추가", exact: true }).click();
  await page.getByPlaceholder("운동 검색").fill("플라이");
  await page.locator(".exercise-option").filter({ hasText: "플라이" }).first().click();
  await page.getByRole("button", { name: "플라이 운동 대체" }).click();
  await page.getByLabel("플라이 대체 운동 선택").selectOption("chest-press");
  await page.getByRole("button", { name: "바꾸기", exact: true }).click();
  await expect(page.locator(".exercise-log-card").first().locator(".exercise-title-block strong")).toHaveText("체스트프레스");
});

test("injury profile consent gates the warning, then the badge appears and clears live without blocking logging", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "샘플 데이터로 체험하기" }).click();

  await page.getByRole("button", { name: "내정보", exact: true }).click();
  const shoulderInput = page.locator('#injuryProfileForm input[name="injuryAreas"][value="shoulder"]');
  await expect(shoulderInput).toBeDisabled();

  await page.locator("#injuryHealthDataConsent").check();
  await expect(shoulderInput).toBeEnabled();
  await shoulderInput.check();
  await page.getByRole("button", { name: "부상 프로필 저장", exact: true }).click();
  await expect(page.getByText("부상 프로필을 저장했어요.")).toBeVisible();

  await page.getByRole("button", { name: "기록", exact: true }).click();
  await page.getByRole("button", { name: "운동 추가", exact: true }).click();
  await page.getByPlaceholder("운동 검색").fill("체스트프레스");
  const option = page.locator(".exercise-option").filter({ hasText: "체스트프레스" }).first();
  await expect(option.locator(".injury-warning-badge")).toContainText("어깨");
  await option.click();

  const card = page.locator(".exercise-log-card").filter({ hasText: "체스트프레스" }).first();
  await expect(card.locator(".injury-warning-badge")).toContainText("어깨");

  // 경고는 세트 기록을 막지 않는다.
  await card.locator("[data-toggle-set]").first().click();
  await expect(card.locator(".set-row").first()).toHaveClass(/is-done/);

  // 부위를 해제하면 새로고침 없이 즉시 경고가 사라진다.
  await page.getByRole("button", { name: "내정보", exact: true }).click();
  await shoulderInput.uncheck();
  await page.getByRole("button", { name: "부상 프로필 저장", exact: true }).click();
  await expect(card.locator(".injury-warning-badge")).toHaveCount(0);
});

test("an 'other' injury area shows a general caution banner instead of per-exercise badges and never blocks adding exercises", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "샘플 데이터로 체험하기" }).click();

  await page.getByRole("button", { name: "내정보", exact: true }).click();
  await page.locator("#injuryHealthDataConsent").check();
  await page.locator('#injuryProfileForm input[name="injuryAreas"][value="other"]').check();
  await page.getByRole("button", { name: "부상 프로필 저장", exact: true }).click();

  await page.getByRole("button", { name: "기록", exact: true }).click();
  await expect(page.locator("#workoutLogInjuryNotice")).toBeVisible();

  await page.getByRole("button", { name: "운동 추가", exact: true }).click();
  await expect(page.locator("#exercisePickerInjuryNotice")).toBeVisible();
  await page.getByPlaceholder("운동 검색").fill("체스트프레스");
  const option = page.locator(".exercise-option").filter({ hasText: "체스트프레스" }).first();
  await expect(option.locator(".injury-warning-badge")).toHaveCount(0);
  await option.click();

  await expect(page.locator(".exercise-log-card").filter({ hasText: "체스트프레스" }).first()).toBeVisible();
});
