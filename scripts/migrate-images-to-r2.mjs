import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
];

for (const name of requiredVariables) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET_NAME;
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
const objectPrefix = (process.env.R2_OBJECT_PREFIX || "locations")
  .replace(/^\/+|\/+$/g, "");
const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function getSigningKey(dateStamp) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

async function uploadToR2(key, bytes, contentType) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const encodedKey = key.split("/").map(encodePathSegment).join("/");
  const canonicalUri = `/${encodePathSegment(bucket)}/${encodedKey}`;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const payloadHash = sha256(bytes);
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders =
    `cache-control:${cacheControl}\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders =
    "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = hmac(getSigningKey(dateStamp), stringToSign, "hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${endpoint}${canonicalUri}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Cache-Control": cacheControl,
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: bytes,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status}): ${await response.text()}`);
  }
}

function normalizeGoogleDriveUrl(sourceUrl) {
  const url = new URL(sourceUrl);
  if (!url.hostname.endsWith("drive.google.com")) return sourceUrl;

  const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  const fileId = pathMatch?.[1] || url.searchParams.get("id");
  if (!fileId) return sourceUrl;

  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

function detectImageType(bytes, contentType) {
  const normalizedType = contentType.split(";")[0].trim().toLowerCase();
  const knownTypes = {
    "image/avif": { contentType: "image/avif", extension: "avif" },
    "image/gif": { contentType: "image/gif", extension: "gif" },
    "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
    "image/png": { contentType: "image/png", extension: "png" },
    "image/webp": { contentType: "image/webp", extension: "webp" },
  };
  if (knownTypes[normalizedType]) return knownTypes[normalizedType];

  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return knownTypes["image/jpeg"];
  }
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return knownTypes["image/png"];
  }
  if (bytes.subarray(0, 6).toString("ascii").startsWith("GIF8")) {
    return knownTypes["image/gif"];
  }
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return knownTypes["image/webp"];
  }
  if (bytes.subarray(4, 12).toString("ascii").includes("ftypavif")) {
    return knownTypes["image/avif"];
  }

  throw new Error(`Downloaded file is not a supported image (${contentType || "unknown type"})`);
}

async function downloadImage(sourceUrl) {
  const response = await fetch(normalizeGoogleDriveUrl(sourceUrl), {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());
  const detectedType = detectImageType(bytes, contentType);

  return {
    bytes,
    ...detectedType,
  };
}

async function verifyPublicUrl(url) {
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Public URL returned ${response.status}. Enable the R2 public domain first.`
    );
  }
}

async function loadLocations() {
  const { data, error } = await supabase
    .from("locations")
    .select("id, image_url")
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function updateLocation(id, imageUrl) {
  const { error } = await supabase
    .from("locations")
    .update({ image_url: imageUrl })
    .eq("id", id);

  if (error) throw error;
}

const locations = await loadLocations();
const pending = locations.filter(
  (location) =>
    location.image_url && !location.image_url.startsWith(`${publicBaseUrl}/`)
);

console.log(
  `${APPLY ? "Applying" : "Dry run:"} ${pending.length} of ${locations.length} images need migration.`
);

if (!APPLY) {
  for (const location of pending) {
    console.log(`[dry-run] location ${location.id}: ${location.image_url}`);
  }
  console.log("Run `npm run migrate:images -- --apply` to upload and update rows.");
  process.exit(0);
}

const backupDirectory = path.resolve("migration-backups");
await fs.mkdir(backupDirectory, { recursive: true });
const backupPath = path.join(
  backupDirectory,
  `location-image-urls-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
);
await fs.writeFile(backupPath, `${JSON.stringify(locations, null, 2)}\n`);
console.log(`Saved URL backup to ${backupPath}`);

let migrated = 0;
let failed = 0;

for (const location of pending) {
  try {
    const image = await downloadImage(location.image_url);
    const opaqueName = sha256(`${location.id}:${location.image_url}`).slice(0, 32);
    const objectKey = `${objectPrefix}/${opaqueName}.${image.extension}`;
    const publicUrl = `${publicBaseUrl}/${objectKey
      .split("/")
      .map(encodePathSegment)
      .join("/")}`;

    await uploadToR2(objectKey, image.bytes, image.contentType);
    await verifyPublicUrl(publicUrl);
    await updateLocation(location.id, publicUrl);
    migrated += 1;
    console.log(`[ok] location ${location.id} -> ${publicUrl}`);
  } catch (error) {
    failed += 1;
    console.error(`[failed] location ${location.id}: ${error.message}`);
  }
}

console.log(`Finished: ${migrated} migrated, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
