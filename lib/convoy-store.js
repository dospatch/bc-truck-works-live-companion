import { createHash, randomBytes } from "node:crypto";

const memory = globalThis.__bcConvoyMemory ||= { drivers: new Map(), codes: new Map() };
const now = () => Date.now();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);
const requireRedis = process.env.NODE_ENV === "production";
const key = (suffix) => `bc-companion:v1:${suffix}`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function assertStorageConfigured() {
  if (requireRedis && !useRedis) {
    throw new Error("Persistent convoy storage is not configured.");
  }
}

async function redis(command) {
  assertStorageConfigured();
  if (!useRedis) throw new Error("Persistent convoy storage is not configured.");
  const response = await fetch(redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Convoy storage unavailable.");
  const result = await response.json();
  if (result.error) throw new Error("Convoy storage unavailable.");
  return result.result;
}
async function get(suffix) {
  assertStorageConfigured();
  if (!useRedis) return null;
  const raw = await redis(["GET", key(suffix)]);
  return raw ? JSON.parse(raw) : null;
}
async function set(suffix, value, ttlSeconds) {
  assertStorageConfigured();
  if (useRedis) await redis(["SET", key(suffix), JSON.stringify(value), "EX", String(ttlSeconds)]);
}

export function newSecret(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
}
export async function createPairing(code, expiresAt) {
  assertStorageConfigured();
  const record = { code, expiresAt, createdAt: now() };
  if (useRedis) await set(`paircode:${code}`, record, 600);
  else memory.codes.set(code, record);
  return record;
}
export async function consumePairing(code, driverName) {
  assertStorageConfigured();
  const normalized = String(code || "").toUpperCase();
  if (!normalized) return null;
  const record = useRedis ? await get(`paircode:${normalized}`) : memory.codes.get(normalized);
  if (!record || record.expiresAt <= now()) return null;

  const token = newSecret();
  const tokenHash = hash(token);
  const driverId = newSecret(12);
  const driver = {
    id: driverId,
    name: String(driverName || "Truck driver").trim().slice(0, 40) || "Truck driver",
    tokenHash,
    updatedAt: now(),
    telemetry: null,
  };
  const ttl = 60 * 60 * 24 * 30;

  if (useRedis) {
    // Consume the pairing code and save the driver atomically so two requests
    // cannot redeem the same code and create competing driver accounts.
    const script = [
      "local raw = redis.call('GET', KEYS[1])",
      "if not raw then return 0 end",
      "local ok, pair = pcall(cjson.decode, raw)",
      "if not ok or tonumber(pair.expiresAt or 0) <= tonumber(ARGV[4]) then",
      "  redis.call('DEL', KEYS[1])",
      "  return 0",
      "end",
      "redis.call('DEL', KEYS[1])",
      "redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[3])",
      "redis.call('SET', KEYS[3], ARGV[2], 'EX', ARGV[3])",
      "redis.call('SADD', KEYS[4], ARGV[5])",
      "return 1",
    ].join("\n");
    const consumed = await redis([
      "EVAL", script, "4",
      key(`paircode:${normalized}`),
      key(`driver:${driverId}`),
      key(`token:${tokenHash}`),
      key("drivers"),
      JSON.stringify(driver),
      JSON.stringify({ driverId }),
      String(ttl),
      String(now()),
      driverId,
    ]);
    if (Number(consumed) !== 1) return null;
  } else {
    memory.codes.delete(normalized);
    memory.drivers.set(driverId, driver);
    memory.drivers.set(`token:${tokenHash}`, { driverId });
  }
  return { token, driverId, name: driver.name };
}
export async function findDriverByToken(token) {
  assertStorageConfigured();
  if (!token || typeof token !== "string" || token.length > 256) return null;
  const tokenHash = hash(token);
  if (useRedis) {
    const pointer = await get(`token:${tokenHash}`);
    if (!pointer) return null;
    const driver = await get(`driver:${pointer.driverId}`);
    return driver ? { ...driver, tokenHash } : null;
  }
  const pointer = memory.drivers.get(`token:${tokenHash}`);
  const driver = pointer && memory.drivers.get(pointer.driverId);
  return driver ? { ...driver, tokenHash } : null;
}
export async function saveTelemetry(driverId, telemetry) {
  assertStorageConfigured();
  const driver = useRedis ? await get(`driver:${driverId}`) : memory.drivers.get(driverId);
  if (!driver) return false;
  const updated = { ...driver, telemetry, updatedAt: now() };
  if (useRedis) await set(`driver:${driverId}`, updated, 60 * 60 * 24 * 30);
  else memory.drivers.set(driverId, updated);
  return true;
}
export async function listDrivers() {
  assertStorageConfigured();
  if (!useRedis) return [...memory.drivers.entries()].filter(([k, v]) => !k.startsWith("token:") && v?.id).map(([, v]) => v);
  const ids = await redis(["SMEMBERS", key("drivers")]) || [];
  const drivers = await Promise.all(ids.map((id) => get(`driver:${id}`)));
  return drivers.filter(Boolean);
}
export function storageMode() { return useRedis ? "redis" : "memory"; }
