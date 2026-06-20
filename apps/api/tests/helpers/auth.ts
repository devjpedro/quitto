import { eq } from "drizzle-orm";
import { app } from "../../src/app";
import { db } from "../../src/db/client";
import { user } from "../../src/db/schema";

let emailSeq = 0;
export function uniqueEmail(tag: string): string {
  emailSeq += 1;
  return `${tag}-${Date.now()}-${emailSeq}@example.com`;
}

/**
 * Signs up, marks the email as verified, signs in, and returns the session
 * cookie. Stays valid once requireEmailVerification is enabled.
 */
export async function signUpCookie(email: string): Promise<string> {
  await app.handle(
    new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Test", email, password: "password123" }),
    })
  );

  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.email, email));

  const res = await app.handle(
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "password123" }),
    })
  );
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("sign-in did not return a set-cookie header");
  }
  const [cookie] = setCookie.split(";");
  if (!cookie) {
    throw new Error("could not parse session cookie");
  }
  return cookie;
}
