import { createPrivateKey } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";

// Returns a short-lived signed playback token, or null if Mux is not configured.
export async function signPlaybackToken(playbackId: string) {
  const keyId = process.env.MUX_SIGNING_KEY_ID;
  const base64Key = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!keyId || !base64Key) return null;

  try {
    const pem = Buffer.from(base64Key, "base64").toString("utf8");
    const pkcs8 = createPrivateKey(pem).export({ type: "pkcs8", format: "pem" });
    const key = await importPKCS8(pkcs8.toString(), "RS256");
    return await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: keyId })
      .setSubject(playbackId)
      .setAudience("v")
      .setExpirationTime("2h")
      .sign(key);
  } catch {
    return null;
  }
}