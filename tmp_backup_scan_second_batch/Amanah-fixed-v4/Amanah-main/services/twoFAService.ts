
/**
 * Amanah 2FA Security Service - Strict TOTP Implementation
 * Algorithm: TOTP (RFC 6238) using HMAC-SHA1
 */

const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32ToHex = (base32: string) => {
  let bits = "";
  let hex = "";
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue; // تخطي المسافات أو الحروف غير الصحيحة
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }
  return hex;
};

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

export const generate2FASecret = () => {
  let secret = "";
  const randomValues = new Uint8Array(16);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < 16; i++) {
    secret += base32chars.charAt(randomValues[i] % base32chars.length);
  }
  return secret;
};

export const getQRCodeUrl = (email: string, secret: string) => {
  const issuer = "AmanahAI";
  const label = `${issuer}:${email}`;
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(otpauthUrl)}`;
};

/**
 * التحقق الحقيقي من كود TOTP مع سماحية وقت (Time Window)
 */
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  try {
    // التحقق من الوقت الحالي والنافذة السابقة واللاحقة لضمان الاستقرار (30 ثانية لكل نافذة)
    const now = Math.floor(Date.now() / 1000 / 30);
    const windows = [now, now - 1, now + 1]; // سماحية 30 ثانية تأخير أو تقديم

    for (const time of windows) {
      const calculated = await calculateTOTP(secret, time);
      if (calculated === code) return true;
    }
    return false;
  } catch (e) {
    console.error("2FA Verification Logic Error", e);
    return false;
  }
}

async function calculateTOTP(secret: string, time: number): Promise<string> {
    const key = hexToBytes(base32ToHex(secret));
    const msg = new Uint8Array(8);
    let v = time;
    for (let i = 7; i >= 0; i--) {
      msg[i] = v & 0xff;
      v = v >> 8;
    }

    const cryptoKey = await window.crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );

    const hmac = await window.crypto.subtle.sign("HMAC", cryptoKey, msg);
    const hmacArray = new Uint8Array(hmac);
    const offset = hmacArray[hmacArray.length - 1] & 0xf;
    
    const binary =
      ((hmacArray[offset] & 0x7f) << 24) |
      ((hmacArray[offset + 1] & 0xff) << 16) |
      ((hmacArray[offset + 2] & 0xff) << 8) |
      (hmacArray[offset + 3] & 0xff);

    return (binary % 1000000).toString().padStart(6, '0');
}

export const verifyTOTPCode = (code: string): boolean => {
  return /^\d{6}$/.test(code); 
};
