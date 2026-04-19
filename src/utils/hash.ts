export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashStr = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${salt}:${hashStr}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hashStr] = stored.split(":");
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const inputHashStr = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return inputHashStr === hashStr;
}
