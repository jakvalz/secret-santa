import { hashPin, verifyPin } from "../lib/auth.js";
import { runDraw } from "../lib/draw.js";
import { privateCode, shortId } from "../lib/ids.js";
import {
  findByParticipantCode,
  getExchange,
  indexParticipantCode,
  saveExchange,
} from "../lib/store.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

function publicExchange(exchange, { includeCodes = false } = {}) {
  return {
    id: exchange.id,
    name: exchange.name,
    status: exchange.status,
    createdAt: exchange.createdAt,
    participants: exchange.participants.map((p) => ({
      id: p.id,
      name: p.name,
      ...(includeCodes ? { code: p.code } : {}),
    })),
    exclusions: exchange.exclusions,
    drawnAt: exchange.drawnAt || null,
  };
}

async function requireModerator(exchange, pin) {
  return verifyPin(pin, exchange.pinHash);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const rawPath = event.path || "";
    const path = rawPath
      .replace(/^\/\.netlify\/functions\/api/, "")
      .replace(/^\/api/, "")
      .replace(/\/$/, "") || "/";

    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};
    const qs = event.queryStringParameters || {};

    // POST /exchanges — create
    if (method === "POST" && path === "/exchanges") {
      const name = String(body.name || "").trim();
      const pin = String(body.pin || "").trim();
      if (!name || name.length > 80) {
        return json(400, { error: "invalid_name" });
      }
      if (!/^\d{4,8}$/.test(pin)) {
        return json(400, { error: "invalid_pin" });
      }
      const exchange = {
        id: shortId(8),
        name,
        pinHash: await hashPin(pin),
        createdAt: new Date().toISOString(),
        status: "setup",
        participants: [],
        exclusions: [],
        assignments: null,
        drawnAt: null,
      };
      await saveExchange(exchange);
      return json(201, { exchange: publicExchange(exchange, { includeCodes: true }) });
    }

    // GET /exchanges/:id
    const getMatch = path.match(/^\/exchanges\/([^/]+)$/);
    if (method === "GET" && getMatch) {
      const exchange = await getExchange(getMatch[1]);
      if (!exchange) return json(404, { error: "not_found" });
      const pin = qs.pin || "";
      const isMod = pin ? await requireModerator(exchange, pin) : false;
      if (pin && !isMod) return json(401, { error: "bad_pin" });
      return json(200, {
        exchange: publicExchange(exchange, { includeCodes: isMod }),
        isModerator: isMod,
      });
    }

    // POST /exchanges/:id/unlock — verify PIN
    const unlockMatch = path.match(/^\/exchanges\/([^/]+)\/unlock$/);
    if (method === "POST" && unlockMatch) {
      const exchange = await getExchange(unlockMatch[1]);
      if (!exchange) return json(404, { error: "not_found" });
      const ok = await requireModerator(exchange, body.pin);
      if (!ok) return json(401, { error: "bad_pin" });
      return json(200, {
        exchange: publicExchange(exchange, { includeCodes: true }),
        isModerator: true,
      });
    }

    // POST /exchanges/:id/participants
    const addPartMatch = path.match(/^\/exchanges\/([^/]+)\/participants$/);
    if (method === "POST" && addPartMatch) {
      const exchange = await getExchange(addPartMatch[1]);
      if (!exchange) return json(404, { error: "not_found" });
      if (!(await requireModerator(exchange, body.pin))) {
        return json(401, { error: "bad_pin" });
      }
      if (exchange.status === "drawn") {
        return json(409, { error: "already_drawn" });
      }
      const name = String(body.name || "").trim();
      if (!name || name.length > 60) {
        return json(400, { error: "invalid_name" });
      }
      if (exchange.participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        return json(409, { error: "duplicate_name" });
      }
      if (exchange.participants.length >= 40) {
        return json(400, { error: "too_many" });
      }
      const participant = {
        id: shortId(5),
        name,
        code: privateCode(),
      };
      exchange.participants.push(participant);
      await saveExchange(exchange);
      await indexParticipantCode(participant.code, exchange.id, participant.id);
      return json(201, {
        participant: { id: participant.id, name: participant.name, code: participant.code },
        exchange: publicExchange(exchange, { includeCodes: true }),
      });
    }

    // DELETE /exchanges/:id/participants/:pid
    const delPartMatch = path.match(/^\/exchanges\/([^/]+)\/participants\/([^/]+)$/);
    if (method === "DELETE" && delPartMatch) {
      const exchange = await getExchange(delPartMatch[1]);
      if (!exchange) return json(404, { error: "not_found" });
      const pin = body.pin || qs.pin || "";
      if (!(await requireModerator(exchange, pin))) {
        return json(401, { error: "bad_pin" });
      }
      if (exchange.status === "drawn") {
        return json(409, { error: "already_drawn" });
      }
      const pid = delPartMatch[2];
      exchange.participants = exchange.participants.filter((p) => p.id !== pid);
      exchange.exclusions = exchange.exclusions.filter(
        (e) => e.from !== pid && e.to !== pid
      );
      await saveExchange(exchange);
      return json(200, { exchange: publicExchange(exchange, { includeCodes: true }) });
    }

    // PUT /exchanges/:id/exclusions
    const exclMatch = path.match(/^\/exchanges\/([^/]+)\/exclusions$/);
    if (method === "PUT" && exclMatch) {
      const exchange = await getExchange(exclMatch[1]);
      if (!exchange) return json(404, { error: "not_found" });
      if (!(await requireModerator(exchange, body.pin))) {
        return json(401, { error: "bad_pin" });
      }
      if (exchange.status === "drawn") {
        return json(409, { error: "already_drawn" });
      }
      const ids = new Set(exchange.participants.map((p) => p.id));
      const exclusions = Array.isArray(body.exclusions) ? body.exclusions : [];
      const cleaned = [];
      for (const e of exclusions) {
        if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
        cleaned.push({ from: e.from, to: e.to });
      }
      exchange.exclusions = cleaned;
      await saveExchange(exchange);
      return json(200, { exchange: publicExchange(exchange, { includeCodes: true }) });
    }

    // POST /exchanges/:id/draw
    const drawMatch = path.match(/^\/exchanges\/([^/]+)\/draw$/);
    if (method === "POST" && drawMatch) {
      const exchange = await getExchange(drawMatch[1]);
      if (!exchange) return json(404, { error: "not_found" });
      if (!(await requireModerator(exchange, body.pin))) {
        return json(401, { error: "bad_pin" });
      }
      if (exchange.status === "drawn") {
        return json(409, { error: "already_drawn" });
      }
      if (exchange.participants.length < 2) {
        return json(400, { error: "need_two" });
      }
      const assignments = runDraw(
        exchange.participants.map((p) => p.id),
        exchange.exclusions
      );
      if (!assignments) {
        return json(422, { error: "impossible_draw" });
      }
      exchange.assignments = assignments;
      exchange.status = "drawn";
      exchange.drawnAt = new Date().toISOString();
      await saveExchange(exchange);
      // True secrecy: do not return the map — only share links
      return json(200, {
        exchange: publicExchange(exchange, { includeCodes: true }),
        ok: true,
      });
    }

    // GET /reveal/:code — participant learns only their assignee
    const revealMatch = path.match(/^\/reveal\/([^/]+)$/);
    if (method === "GET" && revealMatch) {
      const found = await findByParticipantCode(revealMatch[1]);
      if (!found) return json(404, { error: "not_found" });
      const { exchange, participantId } = found;
      const me = exchange.participants.find((p) => p.id === participantId);
      if (!me) return json(404, { error: "not_found" });
      if (exchange.status !== "drawn" || !exchange.assignments) {
        return json(200, {
          ready: false,
          exchangeName: exchange.name,
          yourName: me.name,
        });
      }
      const receiverId = exchange.assignments[participantId];
      const receiver = exchange.participants.find((p) => p.id === receiverId);
      return json(200, {
        ready: true,
        exchangeName: exchange.name,
        yourName: me.name,
        giveTo: receiver?.name || "?",
      });
    }

    return json(404, { error: "route_not_found", path });
  } catch (err) {
    console.error(err);
    return json(500, { error: "server_error", message: String(err.message || err) });
  }
}
