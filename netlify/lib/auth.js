import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPin(pin) {
  return bcrypt.hash(String(pin), ROUNDS);
}

export async function verifyPin(pin, hash) {
  if (!pin || !hash) return false;
  return bcrypt.compare(String(pin), hash);
}
