import { randomBytes } from "node:crypto";

export function shortId(bytes = 6) {
  return randomBytes(bytes).toString("base64url");
}

export function privateCode() {
  return randomBytes(9).toString("base64url");
}
