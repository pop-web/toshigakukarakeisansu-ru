// アクセスロック（限定公開）: 許可されたGoogleアカウントのuidだけ同期可。
// ここが唯一の許可リスト（1箇所）。同じuidを firestore.rules にも反映すること。

const RAW_ALLOWED: string[] = [
  // 許可する Firebase Auth UID（28文字）。複数可。
  // 取得: Firebaseコンソール → Authentication → ユーザー一覧 → 自分の行の「ユーザーUID」
  "c3cbU6J4jwWPJDsXWNETk3iMPpz1", // koga（popweb782@gmail.com）
];

export const allowedUids = RAW_ALLOWED.filter(
  (u) => u && !u.startsWith("REPLACE")
);

// 許可リストが空なら誰でも同期可（ロールバック簡単）。空でなければ許可uidのみ。
export const accessLockEnabled = allowedUids.length > 0;

export const isAllowed = (uid: string): boolean =>
  !accessLockEnabled || allowedUids.includes(uid);
