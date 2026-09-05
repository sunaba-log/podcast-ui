"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

function requiredPublicEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getFirebaseAuth() {
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: requiredPublicEnv(
            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            "NEXT_PUBLIC_FIREBASE_API_KEY",
          ),
          authDomain: requiredPublicEnv(
            process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
          ),
          projectId: requiredPublicEnv(
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
          ),
        });
  return getAuth(app);
}

export function getGoogleAuthProvider() {
  const provider = new GoogleAuthProvider();
  // 常にアカウント選択を表示し、別アカウントでの登録・切り替えを可能にする
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
