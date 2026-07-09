import {
  create,
  verify as djwtVerify,
  getNumericDate,
  type Payload,
} from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const encoder = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("APP_JWT_SECRET");
  if (!secret) {
    throw new Error("APP_JWT_SECRET is not set");
  }
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

// アプリ独自のセッショントークン(Supabase Authは使わないため、この署名済みJWTがセッションの正体)
export async function issueToken(
  payload: Record<string, unknown>,
  expiresInSeconds: number,
): Promise<string> {
  const key = await getKey();
  return await create(
    { alg: "HS256", typ: "JWT" },
    { ...payload, exp: getNumericDate(expiresInSeconds) },
    key,
  );
}

export async function verifyToken(token: string): Promise<Payload> {
  const key = await getKey();
  return await djwtVerify(token, key);
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
