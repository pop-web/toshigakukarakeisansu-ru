// Firebase Auth（Googleログイン）＋ Firestore 同期（任意ログイン）
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import type { HistoryEntry, Settings } from "./types/storage";

export type { User };

export type CloudData = {
  history: HistoryEntry[];
  settings: Settings;
  updatedAt?: number;
};

export const watchAuth = (cb: (u: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export const signInGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);

const userDoc = (uid: string) => doc(db, "sizing", uid);

export const loadCloud = async (uid: string): Promise<CloudData | null> => {
  const snap = await getDoc(userDoc(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    history: Array.isArray(data.history)
      ? (data.history as HistoryEntry[])
      : [],
    settings: (data.settings as Settings) || {},
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : undefined,
  };
};

export const saveCloud = async (
  uid: string,
  history: HistoryEntry[],
  settings: Settings
) => {
  await setDoc(userDoc(uid), { history, settings, updatedAt: Date.now() });
};

// 履歴を id で重複排除して統合（新しい順）
export const mergeHistory = (
  a: HistoryEntry[],
  b: HistoryEntry[]
): HistoryEntry[] => {
  const map = new Map<string, HistoryEntry>();
  for (const e of [...a, ...b]) {
    if (e && e.id && !map.has(e.id)) map.set(e.id, e);
  }
  return Array.from(map.values()).sort(
    (x, y) => (y.timestamp || 0) - (x.timestamp || 0)
  );
};
