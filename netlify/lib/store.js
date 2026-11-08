import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectLambda, getStore } from "@netlify/blobs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Prefer /tmp on Lambda (read-only bundle FS); local uses repo `.data/`. */
function dataPaths() {
  const onLambda = Boolean(process.env.LAMBDA_TASK_ROOT || process.env.NETLIFY);
  const base = onLambda
    ? path.join("/tmp", "secret-santa-data")
    : path.resolve(__dirname, "../../.data");
  return {
    dir: base,
    file: path.join(base, "exchanges.json"),
  };
}

async function fileLoad() {
  try {
    const raw = await fs.readFile(dataPaths().file, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function fileSave(all) {
  const { dir, file } = dataPaths();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(all, null, 2), "utf8");
}

/**
 * Wire Netlify Blobs for Lambda-compatible handlers.
 * Must run once per request before getStore().
 */
export function initBlobs(event) {
  if (!event) return;
  try {
    connectLambda(event);
  } catch {
    /* local/unlinked — file store fallback */
  }
}

function getBlobStore() {
  try {
    return getStore({ name: "secret-santa", consistency: "strong" });
  } catch {
    return null;
  }
}

export async function getExchange(id) {
  const store = getBlobStore();
  if (store) {
    try {
      const value = await store.get(id, { type: "json" });
      if (value) return value;
    } catch {
      /* fall through to file store */
    }
  }
  const all = await fileLoad();
  return all[id] || null;
}

export async function saveExchange(exchange) {
  const store = getBlobStore();
  if (store) {
    try {
      await store.setJSON(exchange.id, exchange);
      try {
        const all = await fileLoad();
        all[exchange.id] = exchange;
        await fileSave(all);
      } catch {
        /* mirror is best-effort */
      }
      return;
    } catch {
      /* Blobs unavailable — file fallback below */
    }
  }
  const all = await fileLoad();
  all[exchange.id] = exchange;
  await fileSave(all);
}

export async function findByParticipantCode(code) {
  const store = getBlobStore();
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
  const store = getBlobStore();
  if (store) {
    try {
      await store.setJSON(`code:${code}`, { exchangeId, participantId });
      return;
    } catch {
      /* full-scan fallback via findByParticipantCode */
    }
  }
}
