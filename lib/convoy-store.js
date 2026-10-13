import { createHash, randomBytes } from "node:crypto";

const memory = globalThis.__bcConvoyMemory ||= { drivers: new Map(), codes: new Map() };
const now = () => Date.now();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);
const key = (suffix) => `bc-companion:v1:${suffix}`;
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function redis(command) {
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
  if (!useRedis) return null;
  const raw = await redis(["GET", key(suffix)]);
  return raw ? JSON.parse(raw) : null;
}
async function set(suffix, value, ttlSeconds) {
  if (useRedis) {
    await redis(["SET", key(suffix), JSON.stringify(value), "EX", String(ttlSeconds)]);
  }
}

export function newSecret(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
}
export async function createPairing(code, expiresAt) {
  const record = { code, expiresAt, createdAt: now() };
  if (useRedis) await set(`paircode:${code}`, record, 600);
  else memory.codes.set(code, record);
  return record;
}
export async function consumePairing(code, driverName) {
  const normalized = String(code || "").toUpperCase();
  const record = useRedis ? await get(`paircode:${normalized}`) : memory.codes.get(normalized);
  if (!record || record.expiresAt <= now()) return null;
  const token = newSecret();
  const driverId = newSecret(12);
  const driver = { id: driverId, name: String(driverName || "Truck driver").trim().slice(0, 40) || "Truck driver", tokenHash: hash(token), updatedAt: now(), telemetry: null };
  if (useRedis) {
    await redis(["DEL", key(`paircode:${normalized}`)]);
    await set(`driver:${driverId}`, driver, 60 * 60 * 24 * 30);
    await set(`token:${hash(token)}`, { driverId }, 60 * 60 * 24 * 30);
    await redis(["SADD", key("drivers"), driverId]);
  } else {
    memory.codes.delete(normalized);
    memory.drivers.set(driverId, driver);
    memory.drivers.set(`token:${hash(token)}`, { driverId });
  }
  return { token, driverId, name: driver.name };
}
export async function findDriverByToken(token) {
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
  const driver = useRedis ? await get(`driver:${driverId}`) : memory.drivers.get(driverId);
  if (!driver) return false;
  const updated = { ...driver, telemetry, updatedAt: now() };
  if (useRedis) await set(`driver:${driverId}`, updated, 60 * 60 * 24 * 30);
  else memory.drivers.set(driverId, updated);
  return true;
}
export async function listDrivers() {
  if (!useRedis) return [...memory.drivers.entries()].filter(([k,v]) => !k.startsWith("token:") && v?.id).map(([,v]) => v);
  const ids = await redis(["SMEMBERS", key("drivers")]) || [];
  const drivers = await Promise.all(ids.map((id) => get(`driver:${id}`)));
  return drivers.filter(Boolean);
}
export function storageMode() { return useRedis ? "redis" : "memory"; }
