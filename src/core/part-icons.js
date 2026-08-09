/* 부위별 아이콘. 외부 아이콘 폰트/라이브러리 없이 직접 그린 24x24 스트로크 SVG.
   카테고리 문자열은 core/data.js의 exerciseCatalog category와 같은 값을 쓴다. */
const PART_ICONS = {
  가슴: `<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>`,
  등: `<path d="M4 5h16M7 5c0 6 1 9 5 14 4-5 5-8 5-14"/>`,
  하체: `<path d="M8 3v6c0 2-2 3-2 6v6M16 3v6c0 2 2 3 2 6v6M8 9h8"/>`,
  어깨: `<circle cx="12" cy="4.5" r="2.2"/><path d="M5 9.5 12 7.2l7 2.3M12 7.2v7M8 21l4-6.8 4 6.8"/>`,
  팔: `<path d="M5 19l2.5-2.5M16.5 7.5 19 5M6.2 14.8l3 3M14.8 6.2l3 3M9.4 17.2 17.2 9.4"/>`,
  코어: `<rect x="7" y="4" width="10" height="16" rx="3.2"/><path d="M7 9.3h10M7 14.6h10M12 4v16"/>`,
  유산소: `<path d="M12 20.5S4.5 15.6 4.5 10.4A4.2 4.2 0 0 1 12 7.9a4.2 4.2 0 0 1 7.5 2.5c0 5.2-7.5 10.1-7.5 10.1Z"/>`,
  기타: `<circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/>`
};

const FALLBACK_PART = "기타";

/* 예전에 저장된 기록엔 category가 없을 수 있어서 모르는 값은 전부 기타로 떨군다.
   덕분에 data-part에 임의 문자열이 들어갈 일이 없어 이스케이프도 불필요하다. */
export function normalizePart(category) {
  return Object.prototype.hasOwnProperty.call(PART_ICONS, category) ? category : FALLBACK_PART;
}

export function partIcon(category) {
  const part = normalizePart(category);

  return `
    <span class="part-icon" data-part="${part}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${PART_ICONS[part]}</svg>
    </span>
  `;
}
