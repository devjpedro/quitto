import { createAuthClient } from "better-auth/react";

// Mesma origem (proxy): o client fala com /api/auth/* no próprio host.
export const authClient = createAuthClient({ baseURL: window.location.origin });

export const { signIn, signUp, signOut, useSession } = authClient;
