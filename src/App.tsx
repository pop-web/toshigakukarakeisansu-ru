import { useState } from "react";
import {
  ChakraProvider,
  Box,
  Button,
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
} from "@chakra-ui/react";
import { useForm, Controller } from "react-hook-form";

type FormData = {
  stockPrice?: number;
  investmentAmount?: number;
};

type CalcResult =
  | {
      kind: "success";
      shares: number;
      requiredInvestment: number;
    }
  | {
      kind: "insufficient";
      minimumRequiredInvestment: number;
    }
  | {
      kind: "error";
      message: string;
    };

const UNIT_SHARES = 100;

const App = () => {
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      stockPrice: undefined,
      investmentAmount: undefined,
    },
  });
  const [result, setResult] = useState<CalcResult | null>(null);

  const onSubmit = (data: FormData) => {
    const stockPriceRaw = data.stockPrice?.toString().replace(/,/g, "") ?? "";
    const investmentAmountRaw =
      data.investmentAmount?.toString().replace(/,/g, "") ?? "";
    const stockPrice = parseFloat(stockPriceRaw);
    const investmentAmount = parseFloat(investmentAmountRaw) * 10000;

    if (!stockPriceRaw || !investmentAmountRaw) {
      setResult({ kind: "error", message: "株価と投資金額を入力してください。" });
      return;
    }
    if (isNaN(stockPrice) || stockPrice <= 0) {
      setResult({ kind: "error", message: "株価は正の数値で入力してください。" });
      return;
    }
    if (isNaN(investmentAmount) || investmentAmount <= 0) {
      setResult({
        kind: "error",
        message: "投資金額は正の数値で入力してください。",
      });
      return;
    }

    const totalShares = Math.floor(investmentAmount / stockPrice);
    const purchasableShares =
      Math.floor(totalShares / UNIT_SHARES) * UNIT_SHARES;

    if (purchasableShares > 0) {
      setResult({
        kind: "success",
        shares: purchasableShares,
        requiredInvestment: purchasableShares * stockPrice,
      });
    } else {
      setResult({
        kind: "insufficient",
        minimumRequiredInvestment: stockPrice * UNIT_SHARES,
      });
    }
  };

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.50" py={{ base: 6, md: 12 }}>
        <Container maxW="md">
          <Box bg="white" p={{ base: 5, md: 8 }} borderRadius="xl" boxShadow="md">
            <Stack spacing={5}>
              <Box>
                <Heading size="md">投資金額から株数計算スール</Heading>
                <Text mt={1} fontSize="sm" color="gray.600">
                  ※株数は 100株単位 で計算されます。
                </Text>
              </Box>

              <Divider />

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

              {result && (
                <>
                  <Divider />
                  {result.kind === "success" && (
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
                  )}
                  {result.kind === "insufficient" && (
                    <Alert status="warning" borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <Text fontWeight="bold">投資金額が足りません</Text>
                        <Text fontSize="sm">
                          最低 {result.minimumRequiredInvestment.toLocaleString()}
                          円 必要です（100株分）。
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
