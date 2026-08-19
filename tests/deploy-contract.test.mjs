import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("one PowerShell deploy path uploads the complete app without command-line passwords", () => {
  const deploy = read("deploy/deploy.ps1");

  assert.equal(existsSync(new URL("deploy/ftp-deploy.ps1", root)), false);
  assert.equal(existsSync(new URL("deploy/deploy.sh", root)), false);
  assert.match(deploy, /manifest\.webmanifest/);
  assert.match(deploy, /service-worker\.js/);
  assert.match(deploy, /offline\.html/);
  assert.match(deploy, /"assets"/);
  assert.match(deploy, /SITE_URL/);
  assert.match(deploy, /\[switch\]\$NoPause/);
});

test("deploy example contains no password field", () => {
  const example = read("deploy/deploy.env.example");

  assert.match(example, /FTP_HOST=your_ftp_host/);
  assert.match(example, /FTP_USER=your_ftp_user/);
  assert.doesNotMatch(example, /FTP_PASS/);
});
