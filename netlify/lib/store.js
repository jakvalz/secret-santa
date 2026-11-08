import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../.data");
const DATA_FILE = path.join(DATA_DIR, "exchanges.json");

async function fileLoad() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function fileSave(all) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), "utf8");
}

async function getBlobStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({ name: "secret-santa", consistency: "strong" });
  } catch {
    return null;
  }
}

export async function getExchange(id) {
  const store = await getBlobStore();
  if (store) {
    try {
      const value = await store.get(id, { type: "json" });
      if (value) return value;
    } catch {
      // fall through to file store (local/dev)
    }
  }
  const all = await fileLoad();
  return all[id] || null;
}

export async function saveExchange(exchange) {
  const store = await getBlobStore();
  if (store) {
    try {
      await store.setJSON(exchange.id, exchange);
      // also mirror locally in netlify dev for resilience
    } catch (err) {
      // Blobs unavailable (unlinked local) — use file
      const all = await fileLoad();
      all[exchange.id] = exchange;
      await fileSave(all);
      return;
    }
    // Keep a local mirror when running offline tools
    try {
      const all = await fileLoad();
      all[exchange.id] = exchange;
      await fileSave(all);
    } catch {
      /* ignore mirror errors */
    }
    return;
  }
  const all = await fileLoad();
  all[exchange.id] = exchange;
  await fileSave(all);
}

export async function findByParticipantCode(code) {
  const store = await getBlobStore();
  if (store) {
    try {
      const index = await store.get(`code:${code}`, { type: "json" });
      if (index?.exchangeId) {
        const exchange = await getExchange(index.exchangeId);
        if (exchange) return { exchange, participantId: index.participantId };
      }
    } catch {
      /* fall through */
    }
  }
  const all = await fileLoad();
  for (const exchange of Object.values(all)) {
    const participant = exchange.participants?.find((p) => p.code === code);
    if (participant) {
      return { exchange, participantId: participant.id };
    }
  }
  return null;
}

export async function indexParticipantCode(code, exchangeId, participantId) {
  const store = await getBlobStore();
  if (store) {
    try {
      await store.setJSON(`code:${code}`, { exchangeId, participantId });
      return;
    } catch {
      /* file fallback is enough via full scan */
    }
  }
}
