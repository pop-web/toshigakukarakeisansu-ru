// 履歴・設定の型（App.tsx と cloud.ts で共有）
export type HistoryEntry = {
  id: string;
  timestamp: number;
  market: "JP" | "US";
  symbol?: string;
  stockPrice: number;
  shares: number;
  investmentAmountJpy: number;
  distancePct?: number;
  exchangeRate?: number;
  investmentAmountUsd?: number;
};

export type Settings = {
  totalFundsManYen?: number; // 総資金（万円）
};
