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
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { useForm, Controller } from "react-hook-form";

type JpFormData = {
  stockPrice?: number;
  investmentAmount?: number;
  ma20DistancePercent?: number;
  ma20Price?: number;
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
};

type CalcResult =
  | {
      kind: "jp-success";
      shares: number;
      requiredInvestment: number;
      stockPrice: number;
      distancePct?: number;
    }
  | {
      kind: "us-success";
      shares: number;
      requiredInvestmentUsd: number;
      requiredInvestmentJpy: number;
      exchangeRate: number;
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
}: {
  setResult: (r: CalcResult | null) => void;
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
      setResult({
        kind: "jp-success",
        shares: purchasableShares,
        requiredInvestment: purchasableShares * stockPrice,
        stockPrice,
        distancePct: isFinite(distPct) && distPct > 0 ? distPct : undefined,
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
}: {
  setResult: (r: CalcResult | null) => void;
}) => {
  const { rate, loading, error, refetch, lastFetched } = useUsdJpyRate();
  const { control, handleSubmit, setValue, watch } = useForm<UsFormData>({
    defaultValues: {
      stockPriceUsd: undefined,
      investmentAmount: undefined,
      exchangeRate: undefined,
    },
  });

  const currentRate = watch("exchangeRate");
  useEffect(() => {
    if (rate && currentRate === undefined) {
      setValue("exchangeRate", rate);
    }
  }, [rate, currentRate, setValue]);

  const onSubmit = (data: UsFormData) => {
    const stockPriceUsd = parseNum(data.stockPriceUsd);
    const investmentAmountJpy = parseNum(data.investmentAmount) * 10000;
    const exchangeRate = parseNum(data.exchangeRate);

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
      setResult({
        kind: "us-success",
        shares: purchasableShares,
        requiredInvestmentUsd,
        requiredInvestmentJpy: requiredInvestmentUsd * exchangeRate,
        exchangeRate,
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

const App = () => {
  const [result, setResult] = useState<CalcResult | null>(null);

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.50" py={{ base: 6, md: 12 }}>
        <Container maxW="md">
          <Box bg="white" p={{ base: 5, md: 8 }} borderRadius="xl" boxShadow="md">
            <Stack spacing={5}>
              <Box>
                <Heading size="md">投資金額から株数計算スゥール</Heading>
                <Text mt={1} fontSize="sm" color="gray.600">
                  日本株は100株単位、米国株は1株単位で計算します。
                </Text>
              </Box>

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
                    <JpStockForm setResult={setResult} />
                  </TabPanel>
                  <TabPanel px={0}>
                    <UsStockForm setResult={setResult} />
                  </TabPanel>
                </TabPanels>
              </Tabs>

              {result && (
                <>
                  <Divider />
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
            </Stack>
          </Box>
        </Container>
      </Box>
    </ChakraProvider>
  );
};

export default App;
