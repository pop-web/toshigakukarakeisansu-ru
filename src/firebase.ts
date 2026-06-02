// Firebase 初期化（共有モジュール）。設定は env（Vite）から読む。
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_API_KEY,
  authDomain: env.VITE_AUTH_DOMAIN,
  projectId: env.VITE_PROJECT_ID,
  storageBucket: env.VITE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_MESSAGING_SENDER_ID,
  appId: env.VITE_APP_ID,
  measurementId: env.VITE_MEASUREMENT_ID,
};

// env が無いとログイン/同期は使えない（計算機能はそのまま使える）
export const firebaseReady = !!firebaseConfig.apiKey;

const app = initializeApp(firebaseConfig);

// Analytics は環境次第で失敗しうるので握りつぶす
try {
  if (firebaseConfig.measurementId) getAnalytics(app);
} catch {
  // ignore
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
