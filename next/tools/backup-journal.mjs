/* Copy journal.json to backups/journal-<ISO>.json and check SHA-256.
   GitHub: node next/tools/backup-journal.mjs
   Token: GITHUB_TOKEN or DONG_GH_TOKEN, or --token. Repo: Dong-Xuyong/progress-sync.
   Local check: node next/tools/backup-journal.mjs --local <src> <destDir>
   Never overwrites an existing backup. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_REPO = "Dong-Xuyong/progress-sync";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function backupFilename(date, suffix) {
  var stamp = date.toISOString().replace(/:/g, "-");
  return "journal-" + stamp + (suffix ? "-" + suffix : "") + ".json";
}

function parseArgs(argv) {
  var out = { local: false, src: "", dest: "", token: "", repo: process.env.DONG_GH_REPO || DEFAULT_REPO };
  var i;
  for (i = 0; i < argv.length; i++) {
    if (argv[i] === "--local") {
      out.local = true;
      out.src = argv[i + 1] || "";
      out.dest = argv[i + 2] || "";
      i += 2;
    } else if (argv[i] === "--token") {
      out.token = argv[i + 1] || "";
      i += 1;
    } else if (argv[i] === "--repo") {
      out.repo = argv[i + 1] || out.repo;
      i += 1;
    }
  }
  if (!out.token) out.token = process.env.GITHUB_TOKEN || process.env.DONG_GH_TOKEN || "";
  return out;
}

async function putVerified(names, writeCopy, readBack) {
  var original = names.original;
  var hash = sha256(original);
  var chosen = "";
  var n;
  for (n = 0; n < names.candidates.length; n++) {
    try {
      chosen = await writeCopy(names.candidates[n], original);
      break;
    } catch (err) {
      if (err && (err.code === "EEXIST" || err.status === 422 || err.status === 409)) continue;
      throw err;
    }
  }
  if (!chosen) throw new Error("Could not find a free backup name");
  var copy = await readBack(chosen);
  var copyHash = sha256(copy);
  if (hash !== copyHash) {
    console.error("sha256 mismatch");
    console.error("original " + hash);
    console.error("copy " + copyHash);
    process.exit(1);
  }
  console.log(chosen);
  console.log(hash);
  console.log("sha256 match");
}

async function localBackup(src, destDir) {
  var original = await readFile(src);
  var date = new Date();
  var candidates = [backupFilename(date), backupFilename(date, "2"), backupFilename(date, "3"), backupFilename(date, String(process.pid))];
  await mkdir(destDir, { recursive: true });
  await putVerified({ original: original, candidates: candidates }, async function (name, bytes) {
    var dest = path.join(destDir, name);
    await writeFile(dest, bytes, { flag: "wx" });
    return dest;
  }, async function (dest) {
    return readFile(dest);
  });
}

function githubHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "journal-next"
  };
}

async function githubRequest(repo, token, method, filePath, body) {
  var res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + filePath, {
    method: method,
    headers: githubHeaders(token),
    body: body ? JSON.stringify(body) : undefined
  });
  return res;
}

function decodeContent(content) {
  return Buffer.from(String(content).replace(/\s/g, ""), "base64");
}

async function githubBackup(repo, token) {
  var got = await githubRequest(repo, token, "GET", "journal.json");
  if (!got.ok) {
    console.error("Could not read journal.json (" + got.status + ")");
    process.exit(1);
  }
  var file = await got.json();
  var original = decodeContent(file.content);
  var date = new Date();
  var candidates = [backupFilename(date), backupFilename(date, "2"), backupFilename(date, "3"), backupFilename(date, String(process.pid))];
  await putVerified({ original: original, candidates: candidates }, async function (name, bytes) {
    var remotePath = "backups/" + name;
    var existing = await githubRequest(repo, token, "GET", remotePath);
    if (existing.status !== 404) {
      var err = new Error("exists");
      err.status = existing.ok ? 422 : existing.status;
      throw err;
    }
    var put = await githubRequest(repo, token, "PUT", remotePath, {
      message: "Backup journal.json",
      content: Buffer.from(bytes).toString("base64")
    });
    if (!put.ok) {
      var fail = new Error("PUT " + put.status);
      fail.status = put.status;
      throw fail;
    }
    return remotePath;
  }, async function (remotePath) {
    var back = await githubRequest(repo, token, "GET", remotePath);
    if (!back.ok) throw new Error("Could not read backup (" + back.status + ")");
    var body = await back.json();
    return decodeContent(body.content);
  });
}

var args = parseArgs(process.argv.slice(2));
if (args.local) {
  if (!args.src || !args.dest) {
    console.error("Usage: node next/tools/backup-journal.mjs --local <src> <destDir>");
    process.exit(1);
  }
  localBackup(args.src, args.dest).catch(function (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  });
} else if (!args.token) {
  console.error("Set GITHUB_TOKEN or DONG_GH_TOKEN, or pass --token. The token is not stored in the repo.");
  process.exit(1);
} else {
  githubBackup(args.repo, args.token).catch(function (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  });
}
