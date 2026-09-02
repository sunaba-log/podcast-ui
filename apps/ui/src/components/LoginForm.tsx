"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  getFirebaseAuth,
  getGoogleAuthProvider,
} from "@/lib/firebase-client";

function shouldUseRedirectLogin() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)
  );
}

function isPopupBlocked(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "auth/popup-blocked"
  );
}

export function LoginForm({ guestEnabled = false }: { guestEnabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const createSession = useCallback(async (credential: UserCredential) => {
    const idToken = await credential.user.getIdToken();
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const result = (await response.json()) as {
      error?: string;
      registered?: boolean;
    };
    if (!response.ok) {
      throw new Error(result.error ?? "ログインに失敗しました");
    }
    router.push(result.registered ? "/episodes" : "/register");
    router.refresh();
  }, [router]);

  useEffect(() => {
    let active = true;

    async function completeRedirectLogin() {
      try {
        setLoading(true);
        setError("");
        const credential = await getRedirectResult(getFirebaseAuth());
        if (!credential) return;
        await createSession(credential);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "ログインに失敗しました",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void completeRedirectLogin();
    return () => {
      active = false;
    };
  }, [createSession]);

  async function login() {
    try {
      setLoading(true);
      setError("");
      const auth = getFirebaseAuth();
      const provider = getGoogleAuthProvider();
      if (shouldUseRedirectLogin()) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const credential = await signInWithPopup(auth, provider);
      await createSession(credential);
    } catch (caught) {
      if (isPopupBlocked(caught)) {
        await signInWithRedirect(getFirebaseAuth(), getGoogleAuthProvider());
        return;
      }
      setError(
        caught instanceof Error ? caught.message : "ログインに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  const isMockAuthEnabled =
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_MOCK_AUTH === "true";

  async function guestLogin() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/auth/guest-session", {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "ゲストログインに失敗しました");
      }
      router.push("/episodes");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "ゲストログインに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  async function mockLogin() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/auth/mock-session", {
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        registered?: boolean;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "モックログインに失敗しました");
      }
      router.push(result.registered ? "/episodes" : "/register");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "モックログインに失敗しました",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-brand rounded-xs p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900">SparkCast にログイン</h1>
      <p className="mt-2 text-sm text-gray-500">
        ポッドキャストの運営を自動化・支援するツールです。Google アカウントで開始できます。
      </p>
      {error && (
        <p className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {guestEnabled && (
        <div className="mt-6 p-4 rounded-md bg-emerald-50 border border-emerald-200 text-center">
          <p className="text-xs font-semibold text-emerald-800 mb-2">
            🎧 アカウントなしでお試しいただけます
          </p>
          <button
            type="button"
            onClick={guestLogin}
            disabled={loading}
            className="w-full px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ゲストとして試す"}
          </button>
        </div>
      )}
      {isMockAuthEnabled && (
        <div className="mt-6 p-4 rounded-md bg-amber-50 border border-amber-200 text-center">
          <p className="text-xs font-semibold text-amber-800 mb-2">
            🛠️ ローカル開発モード有効
          </p>
          <button
            type="button"
            onClick={mockLogin}
            disabled={loading}
            className="w-full px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "開発用ワンクリックログイン"}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={login}
        disabled={loading}
        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "ログイン中..." : "Googleでログイン"}
      </button>
    </div>
  );
}
