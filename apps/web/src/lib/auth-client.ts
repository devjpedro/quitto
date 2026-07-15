import { createAuthClient } from "better-auth/react";

// Mesma origem (proxy): o client fala com /api/auth/* no próprio host.
// window não existe no SSR; o authClient só é usado no cliente, então guardamos
// a origem (no server fica undefined e nunca é exercido).
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
});

export const { signIn, signUp, signOut } = authClient;
export const requestPasswordReset = authClient.requestPasswordReset;
export const resetPassword = authClient.resetPassword;
export const changePassword = authClient.changePassword;
export const sendVerificationEmail = authClient.sendVerificationEmail;
