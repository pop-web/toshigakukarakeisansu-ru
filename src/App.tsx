import { useCallback, useEffect, useState } from "react";
import {
  ChakraProvider,
  Box,
  Button,
  ButtonGroup,
  Text,
  InputRightAddon,
  InputGroup,
  Stack,
  Input,
  Container,
  Heading,
  FormControl,
  FormLabel,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Alert,
  AlertIcon,
  Divider,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  HStack,
  IconButton,
  Spinner,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  useToast,
  Flex,
  Badge,
} from "@chakra-ui/react";
import { RepeatIcon, SettingsIcon, CopyIcon, DeleteIcon } from "@chakra-ui/icons";
import { useForm, Controller } from "react-hook-form";

type JpFormData = {
  stockPrice?: number;
  investmentAmount?: number;
  ma20DistancePercent?: number;
  ma20Price?: number;
  symbol?: string;
};

// ルール: 投資額(万円) = MIN(500, 750 / 20MAとの距離%)
const JP_LOSS_CUT_YEN = 75_000;
const JP_INVESTMENT_CAP_MAN = 500;
const computeSuggestedInvestmentMan = (distancePct: number): number => {
  if (!isFinite(distancePct) || distancePct <= 0) return NaN;
  const raw = JP_LOSS_CUT_YEN / 10_000 / (distancePct / 100); // 万円換算
  return Math.min(JP_INVESTMENT_CAP_MAN, Math.round(raw));
};

type UsFormData = {
  stockPriceUsd?: number;
  investmentAmount?: number;
  exchangeRate?: number;
  symbol?: string;
  ma20DistancePercent?: number;
  ma20PriceUsd?: number;
};

// ---- 履歴 / 設定 ----
type HistoryEntry = {
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

type Settings = {
  totalFundsManYen?: number; // 総資金（万円）
};

const HISTORY_KEY = "suuru-history-v1";
const SETTINGS_KEY = "suuru-settings-v1";
const HISTORY_MAX = 100;

const loadHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const saveHistory = (entries: HistoryEntry[]) => {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(entries.slice(0, HISTORY_MAX))
    );
  } catch {
    // ignore quota errors
  }
};

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};
const saveSettings = (s: Settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
};

const formatDateSlash = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

type CalcResult =
  | {
      kind: "jp-success";
      shares: number;
      requiredInvestment: number;
      stockPrice: number;
      distancePct?: number;
      symbol?: string;
    }
  | {
      kind: "us-success";
      shares: number;
      stockPriceUsd: number;
      requiredInvestmentUsd: number;
      requiredInvestmentJpy: number;
      exchangeRate: number;
      symbol?: string;
      distancePct?: number;
    }
  | {
      kind: "insufficient";
      minimumRequiredInvestment: number;
      currency: "JPY" | "USD-as-JPY";
    }
  | {
      kind: "error";
      message: string;
    };

const JP_UNIT_SHARES = 100;
const US_UNIT_SHARES = 1;

const useUsdJpyRate = () => {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchRate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await res.json();
      if (data?.result === "success" && typeof data?.rates?.JPY === "number") {
        setRate(data.rates.JPY);
        setLastFetched(new Date());
      } else {
        setError("レート取得に失敗しました");
      }
    } catch {
      setError("レート取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  return { rate, loading, error, refetch: fetchRate, lastFetched };
};

const parseNum = (v: number | undefined): number => {
  if (v === undefined || v === null) return NaN;
  return parseFloat(v.toString().replace(/,/g, ""));
};

const JpStockForm = ({
  setResult,
  addHistory,
}: {
  setResult: (r: CalcResult | null) => void;
  addHistory: (e: Omit<HistoryEntry, "id" | "timestamp">) => void;
}) => {
  const [inputMode, setInputMode] = useState<"distance" | "ma20Price">(
    "distance"
  );

  const { control, handleSubmit, setValue, watch } = useForm<JpFormData>({
    defaultValues: {
      stockPrice: undefined,
      investmentAmount: undefined,
      ma20DistancePercent: undefined,
      ma20Price: undefined,
      symbol: "",
    },
  });

  const watchedStockPrice = watch("stockPrice");
  const watchedMa20Price = watch("ma20Price");
  const distancePct = parseNum(watch("ma20DistancePercent"));
  const overEntryCondition = isFinite(distancePct) && distancePct > 5;

  // 20MA価格モード: 株価とMA20価格から距離%と投資額を自動算出
  useEffect(() => {
    if (inputMode !== "ma20Price") return;
    const sp = parseNum(watchedStockPrice);
    const ma = parseNum(watchedMa20Price);
    if (!isFinite(sp) || !isFinite(ma) || sp <= 0 || ma <= 0) return;
    const dist = ((sp - ma) / sp) * 100;
    const rounded = Math.round(dist * 100) / 100;
    setValue("ma20DistancePercent", rounded, { shouldDirty: true });
    const suggested = computeSuggestedInvestmentMan(rounded);
    if (isFinite(suggested)) {
      setValue("investmentAmount", suggested, { shouldDirty: true });
    }
  }, [inputMode, watchedStockPrice, watchedMa20Price, setValue]);

  const onSubmit = (data: JpFormData) => {
    const stockPrice = parseNum(data.stockPrice);
    const investmentAmount = parseNum(data.investmentAmount) * 10000;
    const distPct = parseNum(data.ma20DistancePercent);
    const symbol = (data.symbol ?? "").trim() || undefined;

    if (!isFinite(stockPrice) || stockPrice <= 0) {
      setResult({ kind: "error", message: "株価は正の数値で入力してください。" });
      return;
    }
    if (!isFinite(investmentAmount) || investmentAmount <= 0) {
      setResult({
        kind: "error",
        message: "投資金額は正の数値で入力してください。",
      });
      return;
    }

    const totalShares = Math.floor(investmentAmount / stockPrice);
    const purchasableShares =
      Math.floor(totalShares / JP_UNIT_SHARES) * JP_UNIT_SHARES;

    if (purchasableShares > 0) {
      const requiredInvestment = purchasableShares * stockPrice;
      const finalDist = isFinite(distPct) && distPct > 0 ? distPct : undefined;
      setResult({
        kind: "jp-success",
        shares: purchasableShares,
        requiredInvestment,
        stockPrice,
        distancePct: finalDist,
        symbol,
      });
      addHistory({
        market: "JP",
        symbol,
        stockPrice,
        shares: purchasableShares,
        investmentAmountJpy: requiredInvestment,
        distancePct: finalDist,
      });
    } else {
      setResult({
        kind: "insufficient",
        minimumRequiredInvestment: stockPrice * JP_UNIT_SHARES,
        currency: "JPY",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <Controller
          name="symbol"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                銘柄
                <Box as="span" ml={2} fontSize="xs" color="gray.500">
                  （任意）
                </Box>
              </FormLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="例: トヨタ自動車 (7203)"
              />
            </FormControl>
          )}
        />
        <Box>
          <Text fontSize="xs" color="gray.600" mb={2} fontWeight="bold">
            入力方法
          </Text>
          <ButtonGroup size="sm" isAttached variant="outline" w="full">
            <Button
              flex="1"
              colorScheme={inputMode === "distance" ? "blue" : "gray"}
              variant={inputMode === "distance" ? "solid" : "outline"}
              onClick={() => setInputMode("distance")}
            >
              距離%で入力
            </Button>
            <Button
              flex="1"
              colorScheme={inputMode === "ma20Price" ? "blue" : "gray"}
              variant={inputMode === "ma20Price" ? "solid" : "outline"}
              onClick={() => setInputMode("ma20Price")}
            >
              20MA価格で入力
            </Button>
          </ButtonGroup>
        </Box>

        <Controller
          name="ma20DistancePercent"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                20MAとの距離
                {inputMode === "ma20Price" && (
                  <Box as="span" ml={2} fontSize="xs" color="gray.500">
                    （自動算出）
                  </Box>
                )}
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder="例: 2.5"
                  isReadOnly={inputMode === "ma20Price"}
                  bg={inputMode === "ma20Price" ? "gray.50" : "white"}
                  onChange={(e) => {
                    field.onChange(e);
                    if (inputMode !== "distance") return;
                    const pct = parseFloat(e.target.value);
                    const suggested = computeSuggestedInvestmentMan(pct);
                    if (isFinite(suggested)) {
                      setValue("investmentAmount", suggested, {
                        shouldDirty: true,
                      });
                    }
                  }}
                />
                <InputRightAddon>%</InputRightAddon>
              </InputGroup>
              {inputMode === "distance" && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  入力すると下の投資金額が自動入力されます（手動で上書きも可）
                </Text>
              )}
              {overEntryCondition && (
                <Text fontSize="xs" color="orange.600" mt={1} fontWeight="bold">
                  ⚠️ 距離 5% 超え。エントリー条件外です。
                </Text>
              )}
            </FormControl>
          )}
        />

        {inputMode === "ma20Price" && (
          <Controller
            name="ma20Price"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormLabel fontSize="sm" mb={1}>
                  20MA価格
                </FormLabel>
                <InputGroup>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    inputMode="decimal"
                    placeholder="例: 1463"
                  />
                  <InputRightAddon>円</InputRightAddon>
                </InputGroup>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  株価とMA20価格から距離%・投資金額を自動算出します
                </Text>
              </FormControl>
            )}
          />
        )}
        <Controller
          name="investmentAmount"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                投資金額
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder="例: 300"
                />
                <InputRightAddon>万円</InputRightAddon>
              </InputGroup>
            </FormControl>
          )}
        />
        <Controller
          name="stockPrice"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                株価
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder="例: 1500"
                />
                <InputRightAddon>円</InputRightAddon>
              </InputGroup>
            </FormControl>
          )}
        />
        <Button colorScheme="blue" type="submit" size="lg">
          株数を計算する
        </Button>
      </Stack>
    </form>
  );
};

const UsStockForm = ({
  setResult,
  addHistory,
}: {
  setResult: (r: CalcResult | null) => void;
  addHistory: (e: Omit<HistoryEntry, "id" | "timestamp">) => void;
}) => {
  const [inputMode, setInputMode] = useState<"distance" | "ma20Price">(
    "distance"
  );

  const { rate, loading, error, refetch, lastFetched } = useUsdJpyRate();
  const { control, handleSubmit, setValue, watch } = useForm<UsFormData>({
    defaultValues: {
      stockPriceUsd: undefined,
      investmentAmount: undefined,
      exchangeRate: undefined,
      symbol: "",
      ma20DistancePercent: undefined,
      ma20PriceUsd: undefined,
    },
  });

  const currentRate = watch("exchangeRate");
  useEffect(() => {
    if (rate && currentRate === undefined) {
      setValue("exchangeRate", rate);
    }
  }, [rate, currentRate, setValue]);

  // 20MA価格モード(US): 株価(USD)とMA20価格(USD)から距離%と投資額を自動算出
  const watchedStockPriceUsd = watch("stockPriceUsd");
  const watchedMa20PriceUsd = watch("ma20PriceUsd");
  const distancePctUs = parseNum(watch("ma20DistancePercent"));
  const overEntryConditionUs =
    isFinite(distancePctUs) && distancePctUs > 5;

  useEffect(() => {
    if (inputMode !== "ma20Price") return;
    const sp = parseNum(watchedStockPriceUsd);
    const ma = parseNum(watchedMa20PriceUsd);
    if (!isFinite(sp) || !isFinite(ma) || sp <= 0 || ma <= 0) return;
    const dist = ((sp - ma) / sp) * 100;
    const rounded = Math.round(dist * 100) / 100;
    setValue("ma20DistancePercent", rounded, { shouldDirty: true });
    const suggested = computeSuggestedInvestmentMan(rounded);
    if (isFinite(suggested)) {
      setValue("investmentAmount", suggested, { shouldDirty: true });
    }
  }, [inputMode, watchedStockPriceUsd, watchedMa20PriceUsd, setValue]);

  const onSubmit = (data: UsFormData) => {
    const stockPriceUsd = parseNum(data.stockPriceUsd);
    const investmentAmountJpy = parseNum(data.investmentAmount) * 10000;
    const exchangeRate = parseNum(data.exchangeRate);
    const symbol = (data.symbol ?? "").trim() || undefined;

    if (!isFinite(stockPriceUsd) || stockPriceUsd <= 0) {
      setResult({
        kind: "error",
        message: "株価（USD）は正の数値で入力してください。",
      });
      return;
    }
    if (!isFinite(investmentAmountJpy) || investmentAmountJpy <= 0) {
      setResult({
        kind: "error",
        message: "投資金額は正の数値で入力してください。",
      });
      return;
    }
    if (!isFinite(exchangeRate) || exchangeRate <= 0) {
      setResult({
        kind: "error",
        message: "為替レートを正しく入力してください。",
      });
      return;
    }

    const investmentAmountUsd = investmentAmountJpy / exchangeRate;
    const purchasableShares =
      Math.floor(investmentAmountUsd / stockPriceUsd / US_UNIT_SHARES) *
      US_UNIT_SHARES;

    if (purchasableShares > 0) {
      const requiredInvestmentUsd = purchasableShares * stockPriceUsd;
      const requiredInvestmentJpy = requiredInvestmentUsd * exchangeRate;
      const distPct = parseNum(data.ma20DistancePercent);
      const finalDist = isFinite(distPct) && distPct > 0 ? distPct : undefined;
      setResult({
        kind: "us-success",
        shares: purchasableShares,
        stockPriceUsd,
        requiredInvestmentUsd,
        requiredInvestmentJpy,
        exchangeRate,
        symbol,
        distancePct: finalDist,
      });
      addHistory({
        market: "US",
        symbol,
        stockPrice: stockPriceUsd,
        shares: purchasableShares,
        investmentAmountJpy: requiredInvestmentJpy,
        investmentAmountUsd: requiredInvestmentUsd,
        exchangeRate,
        distancePct: finalDist,
      });
    } else {
      setResult({
        kind: "insufficient",
        minimumRequiredInvestment: stockPriceUsd * exchangeRate,
        currency: "USD-as-JPY",
      });
    }
  };

  const refreshRate = () => {
    refetch().then(() => {
      // refetch完了後、最新rateを反映するためフォーム上で上書き
    });
  };

  // refreshRate後、rateが更新されたらフォームに反映（ユーザーが手動編集してても上書き）
  useEffect(() => {
    if (rate && lastFetched) {
      setValue("exchangeRate", rate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFetched]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <Controller
          name="symbol"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                銘柄
                <Box as="span" ml={2} fontSize="xs" color="gray.500">
                  （任意）
                </Box>
              </FormLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="例: AAPL"
              />
            </FormControl>
          )}
        />

        <Box>
          <Text fontSize="xs" color="gray.600" mb={2} fontWeight="bold">
            入力方法
          </Text>
          <ButtonGroup size="sm" isAttached variant="outline" w="full">
            <Button
              flex="1"
              colorScheme={inputMode === "distance" ? "blue" : "gray"}
              variant={inputMode === "distance" ? "solid" : "outline"}
              onClick={() => setInputMode("distance")}
            >
              距離%で入力
            </Button>
            <Button
              flex="1"
              colorScheme={inputMode === "ma20Price" ? "blue" : "gray"}
              variant={inputMode === "ma20Price" ? "solid" : "outline"}
              onClick={() => setInputMode("ma20Price")}
            >
              20MA価格で入力
            </Button>
          </ButtonGroup>
        </Box>

        <Controller
          name="ma20DistancePercent"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                20MAとの距離
                {inputMode === "ma20Price" && (
                  <Box as="span" ml={2} fontSize="xs" color="gray.500">
                    （自動算出）
                  </Box>
                )}
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder="例: 2.5"
                  isReadOnly={inputMode === "ma20Price"}
                  bg={inputMode === "ma20Price" ? "gray.50" : "white"}
                  onChange={(e) => {
                    field.onChange(e);
                    if (inputMode !== "distance") return;
                    const pct = parseFloat(e.target.value);
                    const suggested = computeSuggestedInvestmentMan(pct);
                    if (isFinite(suggested)) {
                      setValue("investmentAmount", suggested, {
                        shouldDirty: true,
                      });
                    }
                  }}
                />
                <InputRightAddon>%</InputRightAddon>
              </InputGroup>
              {inputMode === "distance" && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  入力すると下の投資金額が自動入力されます（手動で上書きも可）
                </Text>
              )}
              {overEntryConditionUs && (
                <Text fontSize="xs" color="orange.600" mt={1} fontWeight="bold">
                  ⚠️ 距離 5% 超え。エントリー条件外です。
                </Text>
              )}
            </FormControl>
          )}
        />

        {inputMode === "ma20Price" && (
          <Controller
            name="ma20PriceUsd"
            control={control}
            render={({ field }) => (
              <FormControl>
                <FormLabel fontSize="sm" mb={1}>
                  20MA価格
                </FormLabel>
                <InputGroup>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    inputMode="decimal"
                    placeholder="例: 146.25"
                  />
                  <InputRightAddon>USD</InputRightAddon>
                </InputGroup>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  株価とMA20価格から距離%・投資金額を自動算出します
                </Text>
              </FormControl>
            )}
          />
        )}

        <Controller
          name="investmentAmount"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                投資金額
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder="例: 300"
                />
                <InputRightAddon>万円</InputRightAddon>
              </InputGroup>
            </FormControl>
          )}
        />
        <Controller
          name="stockPriceUsd"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                株価
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder="例: 150.25"
                />
                <InputRightAddon>USD</InputRightAddon>
              </InputGroup>
            </FormControl>
          )}
        />
        <Controller
          name="exchangeRate"
          control={control}
          render={({ field }) => (
            <FormControl>
              <FormLabel fontSize="sm" mb={1}>
                <HStack justify="space-between">
                  <Text fontSize="sm">為替レート (USD/JPY)</Text>
                  <Tooltip label="最新レートを取得">
                    <IconButton
                      aria-label="レート再取得"
                      icon={loading ? <Spinner size="xs" /> : <RepeatIcon />}
                      size="xs"
                      variant="ghost"
                      onClick={refreshRate}
                      isDisabled={loading}
                    />
                  </Tooltip>
                </HStack>
              </FormLabel>
              <InputGroup>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="decimal"
                  placeholder={loading ? "取得中..." : "例: 150.5"}
                />
                <InputRightAddon>円</InputRightAddon>
              </InputGroup>
              {lastFetched && !error && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  最終取得: {lastFetched.toLocaleTimeString()}
                </Text>
              )}
              {error && (
                <Text fontSize="xs" color="red.500" mt={1}>
                  {error}（手動で入力してください）
                </Text>
              )}
            </FormControl>
          )}
        />
        <Button colorScheme="blue" type="submit" size="lg">
          株数を計算する
        </Button>
      </Stack>
    </form>
  );
};

// ---- 結果からコピペ用テキストを生成 ----
const buildCopyText = (
  result: CalcResult,
  settings: Settings
): string | null => {
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;
  const fmtY = (n: number) => `¥${Math.round(n).toLocaleString()}`;
  const fmtD = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const totalFundsYen =
    settings.totalFundsManYen !== undefined
      ? settings.totalFundsManYen * 10000
      : undefined;

  if (result.kind === "jp-success") {
    const header = result.symbol ? `${dateStr} ${result.symbol}` : dateStr;
    const lines = [
      header,
      "─────────────────",
      `エントリー  ${fmtY(result.stockPrice)} × ${result.shares.toLocaleString()}株`,
      `           = ${fmtY(result.requiredInvestment)}`,
    ];
    if (result.distancePct !== undefined) {
      const d = result.distancePct;
      const sl = result.stockPrice * (1 - d / 100);
      const slAmt = result.shares * (result.stockPrice - sl);
      const tpPct = d * 2;
      const tp = result.stockPrice * (1 + tpPct / 100);
      const tpAmt = result.shares * (tp - result.stockPrice);
      const rr = slAmt > 0 ? tpAmt / slAmt : 0;
      lines.push(
        "",
        `20MA距離   ${d.toFixed(2)}%`,
        `🛑 損切り  ${fmtY(sl)} (-${d.toFixed(2)}% / -${fmtY(slAmt)})`,
        `🎯 利確    ${fmtY(tp)} (+${tpPct.toFixed(2)}% / +${fmtY(tpAmt)})`,
        `RR比      ${rr.toFixed(2)}`
      );
    }
    if (totalFundsYen) {
      const ratio = (result.requiredInvestment / totalFundsYen) * 100;
      lines.push(
        "",
        `総資金比率 ${ratio.toFixed(1)}% (総資金 ${settings.totalFundsManYen?.toLocaleString()}万円)`
      );
    }
    return lines.join("\n");
  }

  if (result.kind === "us-success") {
    const header = result.symbol ? `${dateStr} ${result.symbol}` : dateStr;
    const lines = [
      header,
      "─────────────────",
      `エントリー  ${fmtD(result.stockPriceUsd)} × ${result.shares.toLocaleString()}株`,
      `           = ${fmtD(result.requiredInvestmentUsd)}`,
      `円換算     ≈${fmtY(result.requiredInvestmentJpy)}`,
      `レート     1USD = ${result.exchangeRate.toFixed(2)}円`,
    ];
    if (result.distancePct !== undefined) {
      const d = result.distancePct;
      const sl = result.stockPriceUsd * (1 - d / 100);
      const slAmt = result.shares * (result.stockPriceUsd - sl);
      const tpPct = d * 2;
      const tp = result.stockPriceUsd * (1 + tpPct / 100);
      const tpAmt = result.shares * (tp - result.stockPriceUsd);
      const rr = slAmt > 0 ? tpAmt / slAmt : 0;
      lines.push(
        "",
        `20MA距離   ${d.toFixed(2)}%`,
        `🛑 損切り  ${fmtD(sl)} (-${d.toFixed(2)}% / -${fmtD(slAmt)} ≈-${fmtY(slAmt * result.exchangeRate)})`,
        `🎯 利確    ${fmtD(tp)} (+${tpPct.toFixed(2)}% / +${fmtD(tpAmt)} ≈+${fmtY(tpAmt * result.exchangeRate)})`,
        `RR比      ${rr.toFixed(2)}`
      );
    }
    if (totalFundsYen) {
      const ratio = (result.requiredInvestmentJpy / totalFundsYen) * 100;
      lines.push(
        "",
        `総資金比率 ${ratio.toFixed(1)}% (総資金 ${settings.totalFundsManYen?.toLocaleString()}万円)`
      );
    }
    return lines.join("\n");
  }
  return null;
};

// ---- 設定モーダル ----
const SettingsModal = ({
  isOpen,
  onClose,
  settings,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (s: Settings) => void;
}) => {
  const [val, setVal] = useState<string>(
    settings.totalFundsManYen !== undefined ? String(settings.totalFundsManYen) : ""
  );
  useEffect(() => {
    setVal(
      settings.totalFundsManYen !== undefined ? String(settings.totalFundsManYen) : ""
    );
  }, [settings, isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>設定</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl>
            <FormLabel fontSize="sm">総資金（任意）</FormLabel>
            <InputGroup>
              <Input
                value={val}
                inputMode="decimal"
                placeholder="例: 800"
                onChange={(e) => setVal(e.target.value)}
              />
              <InputRightAddon>万円</InputRightAddon>
            </InputGroup>
            <Text fontSize="xs" color="gray.500" mt={1}>
              設定すると、計算結果に「総資金の何%を投入したか」が表示されます。
            </Text>
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button
            variant="ghost"
            onClick={() => {
              setVal("");
              onSave({ ...settings, totalFundsManYen: undefined });
              onClose();
            }}
          >
            クリア
          </Button>
          <Button
            colorScheme="blue"
            onClick={() => {
              const n = parseFloat(val);
              onSave({
                ...settings,
                totalFundsManYen: isFinite(n) && n > 0 ? n : undefined,
              });
              onClose();
            }}
          >
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// ---- 履歴行 ----
const HistoryRow = ({
  entry,
  onDelete,
}: {
  entry: HistoryEntry;
  onDelete: (id: string) => void;
}) => {
  const date = formatDateSlash(entry.timestamp);
  const moneyJpy = `¥${Math.round(entry.investmentAmountJpy).toLocaleString()}`;
  return (
    <Flex
      align="center"
      justify="space-between"
      py={2}
      borderBottom="1px solid"
      borderColor="gray.100"
      fontSize="sm"
    >
      <Box minW={0} flex="1">
        <HStack spacing={2} mb={0.5}>
          <Text color="gray.500" fontSize="xs">
            {date}
          </Text>
          <Badge colorScheme={entry.market === "JP" ? "blue" : "purple"}>
            {entry.market === "JP" ? "日本株" : "米国株"}
          </Badge>
          {entry.symbol && (
            <Text fontWeight="bold" isTruncated>
              {entry.symbol}
            </Text>
          )}
        </HStack>
        <Text color="gray.700" fontSize="xs">
          {entry.market === "JP"
            ? `¥${entry.stockPrice.toLocaleString()}`
            : `$${entry.stockPrice}`}
          {" × "}
          {entry.shares.toLocaleString()}株 = {moneyJpy}
          {entry.distancePct !== undefined && ` ／ 距離${entry.distancePct.toFixed(2)}%`}
        </Text>
      </Box>
      <IconButton
        aria-label="削除"
        icon={<DeleteIcon />}
        size="xs"
        variant="ghost"
        colorScheme="red"
        onClick={() => onDelete(entry.id)}
      />
    </Flex>
  );
};

const App = () => {
  const [result, setResult] = useState<CalcResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const addHistory = useCallback(
    (e: Omit<HistoryEntry, "id" | "timestamp">) => {
      setHistory((prev) => {
        const next = [
          {
            ...e,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, HISTORY_MAX);
        saveHistory(next);
        return next;
      });
    },
    []
  );

  const deleteHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    if (!confirm("履歴を全部消します。よろしいですか？")) return;
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleSaveSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const onCopy = useCallback(async () => {
    if (!result) return;
    const text = buildCopyText(result, settings);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "コピーしました",
        status: "success",
        duration: 1500,
        position: "top",
      });
    } catch {
      toast({
        title: "コピーに失敗しました",
        status: "error",
        duration: 2000,
        position: "top",
      });
    }
  }, [result, settings, toast]);

  // 総資金比率（円ベース）
  const totalFundsYen =
    settings.totalFundsManYen !== undefined
      ? settings.totalFundsManYen * 10000
      : undefined;

  const ratioText = (jpy: number): string | null => {
    if (!totalFundsYen) return null;
    return `総資金の ${((jpy / totalFundsYen) * 100).toFixed(1)}% (総資金 ${settings.totalFundsManYen?.toLocaleString()}万円)`;
  };

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.50" py={{ base: 6, md: 12 }}>
        <Container maxW="md">
          <Box bg="white" p={{ base: 5, md: 8 }} borderRadius="xl" boxShadow="md">
            <Stack spacing={5}>
              <Flex justify="space-between" align="flex-start">
                <Box>
                  <Heading size="md">投資金額から株数計算すぅーる</Heading>
                  <Text mt={1} fontSize="sm" color="gray.600">
                    日本株は100株単位、米国株は1株単位で計算します。
                  </Text>
                </Box>
                <Tooltip label="設定">
                  <IconButton
                    aria-label="設定"
                    icon={<SettingsIcon />}
                    size="sm"
                    variant="ghost"
                    onClick={onOpen}
                  />
                </Tooltip>
              </Flex>

              <Tabs
                variant="soft-rounded"
                colorScheme="blue"
                onChange={() => setResult(null)}
              >
                <TabList>
                  <Tab>日本株</Tab>
                  <Tab>米国株</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel px={0}>
                    <JpStockForm setResult={setResult} addHistory={addHistory} />
                  </TabPanel>
                  <TabPanel px={0}>
                    <UsStockForm setResult={setResult} addHistory={addHistory} />
                  </TabPanel>
                </TabPanels>
              </Tabs>

              {result && (
                <>
                  <Divider />
                  {(result.kind === "jp-success" ||
                    result.kind === "us-success") && (
                    <Flex justify="flex-end">
                      <Button
                        size="xs"
                        variant="outline"
                        leftIcon={<CopyIcon />}
                        onClick={onCopy}
                      >
                        コピー
                      </Button>
                    </Flex>
                  )}
                  {result.kind === "jp-success" && (
                    <Stack spacing={3}>
                      <SimpleGrid columns={2} spacing={3}>
                        <Stat bg="blue.50" p={3} borderRadius="md">
                          <StatLabel color="blue.700">購入可能株数</StatLabel>
                          <StatNumber color="blue.700">
                            {result.shares.toLocaleString()}
                          </StatNumber>
                          <StatHelpText mb={0}>株</StatHelpText>
                        </Stat>
                        <Stat bg="green.50" p={3} borderRadius="md">
                          <StatLabel color="green.700">実際の投資金額</StatLabel>
                          <StatNumber color="green.700">
                            {result.requiredInvestment.toLocaleString()}
                          </StatNumber>
                          <StatHelpText mb={0}>円</StatHelpText>
                        </Stat>
                      </SimpleGrid>
                      {ratioText(result.requiredInvestment) && (
                        <Text fontSize="xs" color="gray.600" textAlign="right">
                          {ratioText(result.requiredInvestment)}
                        </Text>
                      )}
                      {result.distancePct !== undefined && (() => {
                        const dist = result.distancePct;
                        const stopLossPrice = result.stockPrice * (1 - dist / 100);
                        const stopLossAmount =
                          result.shares * (result.stockPrice - stopLossPrice);
                        const takeProfitPct = dist * 2;
                        const takeProfitPrice =
                          result.stockPrice * (1 + takeProfitPct / 100);
                        const takeProfitAmount =
                          result.shares * (takeProfitPrice - result.stockPrice);
                        const rr =
                          stopLossAmount > 0
                            ? takeProfitAmount / stopLossAmount
                            : 0;
                        return (
                          <SimpleGrid columns={2} spacing={3}>
                            <Stat bg="red.50" p={3} borderRadius="md">
                              <StatLabel color="red.700">🛑 損切り価格</StatLabel>
                              <StatNumber color="red.700" fontSize="lg">
                                ¥{Math.round(stopLossPrice).toLocaleString()}
                              </StatNumber>
                              <StatHelpText mb={0} fontSize="xs">
                                −{dist.toFixed(2)}% ／ 損切り額 ¥
                                {Math.round(stopLossAmount).toLocaleString()}
                              </StatHelpText>
                            </Stat>
                            <Stat bg="purple.50" p={3} borderRadius="md">
                              <StatLabel color="purple.700">🎯 利確目標</StatLabel>
                              <StatNumber color="purple.700" fontSize="lg">
                                ¥{Math.round(takeProfitPrice).toLocaleString()}
                              </StatNumber>
                              <StatHelpText mb={0} fontSize="xs">
                                +{takeProfitPct.toFixed(2)}% ／ 利確額 ¥
                                {Math.round(takeProfitAmount).toLocaleString()}
                                {" ／ "}
                                RR {rr.toFixed(2)}
                              </StatHelpText>
                            </Stat>
                          </SimpleGrid>
                        );
                      })()}
                    </Stack>
                  )}
                  {result.kind === "us-success" && (
                    <Stack spacing={3}>
                      <SimpleGrid columns={2} spacing={3}>
                        <Stat bg="blue.50" p={3} borderRadius="md">
                          <StatLabel color="blue.700">購入可能株数</StatLabel>
                          <StatNumber color="blue.700">
                            {result.shares.toLocaleString()}
                          </StatNumber>
                          <StatHelpText mb={0}>株</StatHelpText>
                        </Stat>
                        <Stat bg="green.50" p={3} borderRadius="md">
                          <StatLabel color="green.700">実際の投資金額</StatLabel>
                          <StatNumber color="green.700">
                            ${result.requiredInvestmentUsd.toLocaleString(
                              undefined,
                              { maximumFractionDigits: 2 }
                            )}
                          </StatNumber>
                          <StatHelpText mb={0}>
                            ≈{" "}
                            {Math.round(
                              result.requiredInvestmentJpy
                            ).toLocaleString()}
                            円
                          </StatHelpText>
                        </Stat>
                      </SimpleGrid>
                      {result.distancePct !== undefined && (() => {
                        const dist = result.distancePct;
                        const stopLossUsd =
                          result.stockPriceUsd * (1 - dist / 100);
                        const stopLossAmountUsd =
                          result.shares * (result.stockPriceUsd - stopLossUsd);
                        const tpPct = dist * 2;
                        const tpUsd = result.stockPriceUsd * (1 + tpPct / 100);
                        const tpAmountUsd =
                          result.shares * (tpUsd - result.stockPriceUsd);
                        const rr =
                          stopLossAmountUsd > 0
                            ? tpAmountUsd / stopLossAmountUsd
                            : 0;
                        const fmtUsd = (n: number) =>
                          n.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          });
                        const slAmtJpy = stopLossAmountUsd * result.exchangeRate;
                        const tpAmtJpy = tpAmountUsd * result.exchangeRate;
                        return (
                          <SimpleGrid columns={2} spacing={3}>
                            <Stat bg="red.50" p={3} borderRadius="md">
                              <StatLabel color="red.700">🛑 損切り価格</StatLabel>
                              <StatNumber color="red.700" fontSize="lg">
                                ${fmtUsd(stopLossUsd)}
                              </StatNumber>
                              <StatHelpText mb={0} fontSize="xs">
                                −{dist.toFixed(2)}% ／ 損切り額 ${fmtUsd(stopLossAmountUsd)}
                                <br />
                                (≈¥{Math.round(slAmtJpy).toLocaleString()})
                              </StatHelpText>
                            </Stat>
                            <Stat bg="purple.50" p={3} borderRadius="md">
                              <StatLabel color="purple.700">🎯 利確目標</StatLabel>
                              <StatNumber color="purple.700" fontSize="lg">
                                ${fmtUsd(tpUsd)}
                              </StatNumber>
                              <StatHelpText mb={0} fontSize="xs">
                                +{tpPct.toFixed(2)}% ／ 利確額 ${fmtUsd(tpAmountUsd)}
                                <br />
                                (≈¥{Math.round(tpAmtJpy).toLocaleString()}) ／ RR {rr.toFixed(2)}
                              </StatHelpText>
                            </Stat>
                          </SimpleGrid>
                        );
                      })()}
                      {ratioText(result.requiredInvestmentJpy) && (
                        <Text fontSize="xs" color="gray.600" textAlign="right">
                          {ratioText(result.requiredInvestmentJpy)}
                        </Text>
                      )}
                      <Text fontSize="xs" color="gray.500" textAlign="right">
                        適用レート: 1 USD = {result.exchangeRate.toFixed(2)} 円
                      </Text>
                    </Stack>
                  )}
                  {result.kind === "insufficient" && (
                    <Alert status="warning" borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <Text fontWeight="bold">投資金額が足りません</Text>
                        <Text fontSize="sm">
                          {result.currency === "JPY"
                            ? `最低 ${result.minimumRequiredInvestment.toLocaleString()}円 必要です（100株分）。`
                            : `最低 ${Math.round(
                                result.minimumRequiredInvestment
                              ).toLocaleString()}円 必要です（1株分）。`}
                        </Text>
                      </Box>
                    </Alert>
                  )}
                  {result.kind === "error" && (
                    <Alert status="error" borderRadius="md">
                      <AlertIcon />
                      <Text>{result.message}</Text>
                    </Alert>
                  )}
                </>
              )}

              <Divider />

              <Box>
                <Flex justify="space-between" align="center" mb={2}>
                  <HStack spacing={2}>
                    <Text fontSize="sm" fontWeight="bold" color="gray.700">
                      履歴
                    </Text>
                    {history.length > 0 && (
                      <Badge colorScheme="gray">{history.length}件</Badge>
                    )}
                  </HStack>
                  {history.length > 0 && (
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      onClick={clearHistory}
                    >
                      全削除
                    </Button>
                  )}
                </Flex>
                {history.length === 0 ? (
                  <Text fontSize="sm" color="gray.400">
                    まだ履歴がありません。計算するとブラウザに保存されます。
                  </Text>
                ) : (
                  <Box maxH="320px" overflowY="auto">
                    {history.map((e) => (
                      <HistoryRow key={e.id} entry={e} onDelete={deleteHistory} />
                    ))}
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>
        </Container>
      </Box>
      <SettingsModal
        isOpen={isOpen}
        onClose={onClose}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </ChakraProvider>
  );
};

export default App;
