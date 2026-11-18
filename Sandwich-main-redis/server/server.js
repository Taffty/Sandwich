import express from "express";
import cors from "cors";
import { createClient } from "redis";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const PORT = Number(process.env.PORT || 3000);
const TEST_MODE = process.env.TEST_MODE === "true";
const MAX_CLICKS_PER_SECOND = Number(process.env.MAX_CLICKS_PER_SECOND || 15);
const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
redis.on("error", error => console.error("Redis error:", error));
await redis.connect();

let adminAuth;
let db;
if (!TEST_MODE) {
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  adminAuth = getAuth();
  db = getFirestore();
}

const testBalances = new Map();
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5500" }));
app.use(express.json({ limit: "10kb" }));

async function identifyUser(request) {
  if (TEST_MODE) return request.get("x-test-user") || "local-test-user";
  const header = request.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("Missing Firebase ID token.");
  const decoded = await adminAuth.verifyIdToken(header.slice(7));
  return decoded.uid;
}

async function allowClick(uid) {
  const second = Math.floor(Date.now() / 1000);
  const key = `click-limit:${uid}:${second}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 2);
  return { allowed: count <= MAX_CLICKS_PER_SECOND, count };
}

async function processTestClick(uid) {
  const balance = (testBalances.get(uid) || 0n) + 1n;
  testBalances.set(uid, balance);
  return { reward: 1n, balance, critical: false };
}

async function processFirestoreClick(uid) {
  const playerRef = db.collection("users").doc(uid);
  const teamRef = db.collection("shared").doc("team");
  let result;

  await db.runTransaction(async transaction => {
    const playerSnapshot = await transaction.get(playerRef);
    const teamSnapshot = await transaction.get(teamRef);
    const player = playerSnapshot.exists ? playerSnapshot.data() : {};
    const team = teamSnapshot.exists ? teamSnapshot.data() : {};
    const levels = team.levels || {};
    const upgrades = player.upgrades || {};
    const rebirths = Number.isInteger(player.rebirths) ? player.rebirths : 0;
    const currentBalance = BigInt(typeof player.clicks === "string" ? player.clicks : "0");
    const baseReward = BigInt((Number.isInteger(upgrades.power) ? upgrades.power : 0) + 1)
      * BigInt(rebirths + 1);
    const criticalChance = 0.01 + (Number(upgrades.luck) || 0) * 0.005 + (Number(levels.crit) || 0) * 0.005;
    const critical = Math.random() < Math.min(0.5, criticalChance);
    let reward = baseReward * BigInt(critical ? 10 : 1);
    reward = reward
      * BigInt(100 + (Number(levels.power) || 0) * 10)
      * BigInt(100 + (Number(levels.motivation) || 0) * 5) / 10000n;
    if (reward < 1n) reward = 1n;

    const balance = currentBalance + reward;
    transaction.set(playerRef, {
      clicks: balance.toString(),
      rebirths,
      upgrades,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    result = { reward, balance, critical };
  });
  return result;
}

app.get("/health", async (request, response) => {
  try {
    await redis.ping();
    response.json({ ok: true, redis: "connected", testMode: TEST_MODE });
  } catch (error) {
    response.status(503).json({ ok: false, error: error.message });
  }
});

app.post("/api/click", async (request, response) => {
  try {
    const uid = await identifyUser(request);
    const requestId = typeof request.body?.requestId === "string" ? request.body.requestId : "";
    if (!requestId || requestId.length > 160) return response.status(400).json({ accepted: false, error: "A valid requestId is required." });

    const firstRequest = await redis.set(`processed-click:${uid}:${requestId}`, "1", { NX: true, EX: 300 });
    if (firstRequest !== "OK") return response.status(409).json({ accepted: false, error: "This click request was already processed." });

    const rate = await allowClick(uid);
    if (!rate.allowed) return response.status(429).json({ accepted: false, error: "You are clicking too quickly." });

    const result = TEST_MODE ? await processTestClick(uid) : await processFirestoreClick(uid);
    response.json({ accepted: true, reward: result.reward.toString(), balance: result.balance.toString(), critical: result.critical });
  } catch (error) {
    console.error("Click request failed:", error);
    response.status(401).json({ accepted: false, error: error.message || "Unauthorized request." });
  }
});

app.listen(PORT, () => console.log(`Sandwich API listening on port ${PORT}${TEST_MODE ? " (TEST MODE)" : ""}`));
