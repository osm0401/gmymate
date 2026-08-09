// 최소 docx 작성기 — 의존성 없이 node:zlib만 사용한다.
// docx는 XML 3개를 담은 zip이라 라이브러리를 붙일 이유가 없다.
// ponytail: 문단/굵기/고정폭만 지원. 표·이미지가 필요해지면 그때 docx 라이브러리로 교체.

import { deflateRawSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

function zip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const f of files) {
    const raw = Buffer.from(f.data, "utf8");
    const data = deflateRawSync(raw);
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(raw);

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(8, 8);      // deflate
    lfh.writeUInt16LE(0x21, 12);  // 1980-01-01 고정
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(raw.length, 22);
    lfh.writeUInt16LE(name.length, 26);
    local.push(lfh, name, data);

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(0x21, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(data.length, 20);
    cdh.writeUInt32LE(raw.length, 24);
    cdh.writeUInt16LE(name.length, 28);
    cdh.writeUInt32LE(offset, 42);
    central.push(cdh, name);

    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, eocd]);
}

function para(text, { bold = false, size = 20, mono = false, indent = 0 } = {}) {
  const rPr =
    `<w:rPr>${bold ? "<w:b/>" : ""}` +
    (mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : "") +
    `<w:sz w:val="${size}"/></w:rPr>`;
  const pPr = `<w:pPr><w:spacing w:after="${bold ? 120 : 60}"/>${indent ? `<w:ind w:left="${indent}"/>` : ""}</w:pPr>`;
  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

// 보고서가 마크다운이라 그대로 문단으로 옮긴다. 표기만 살리는 수준.
export function mdToParagraphs(md) {
  let fence = false;
  return md.split("\n").map((line) => {
    if (line.trim().startsWith("```")) { fence = !fence; return ""; }
    if (fence) return para(line, { mono: true, size: 16, indent: 240 });
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) return para(h[2], { bold: true, size: [32, 26, 22][h[1].length - 1] });
    const b = line.match(/^\s*[-*]\s+(.*)$/);
    if (b) return para(`• ${b[1].replace(/\*\*/g, "")}`, { indent: 240 });
    if (!line.trim()) return para("");
    return para(line.replace(/\*\*/g, ""));
  }).join("");
}

export function writeDocx(file, markdown) {
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    mdToParagraphs(markdown) +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

  writeFileSync(file, zip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { name: "word/document.xml", data: document },
  ]));
  return file;
}

// 파일명용 타임스탬프: 2026-08-09_1432
export const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};
