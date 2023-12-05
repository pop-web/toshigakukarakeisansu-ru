import { useState } from "react";
import {
  ChakraProvider,
  Box,
  Button,
  Text,
  InputRightAddon,
  InputGroup,
  Flex,
  Center,
  Stack,
  Input,
} from "@chakra-ui/react";
import { useForm, Controller } from "react-hook-form";

type FormData = {
  stockPrice?: number;
  investmentAmount?: number;
};

const App = () => {
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      stockPrice: undefined,
      investmentAmount: undefined,
    },
  });
  const [result, setResult] = useState("");

  const onSubmit = (data: FormData) => {
    if (!data.stockPrice || !data.investmentAmount) {
      setResult("株価と投資金額を入力してください。");
      return;
    }

    if (isNaN(data.stockPrice) || data.stockPrice <= 0) {
      setResult("株価は半角数値でなければなりません。");
      return;
    }

    if (isNaN(data.investmentAmount) || data.investmentAmount <= 0) {
      setResult("投資金額は半角数値でなければなりません。");
      return;
    }

    const unitShares = 100;
    const stockPrice = parseFloat(data.stockPrice.toString().replace(/,/g, ""));
    const investmentAmount =
      parseFloat(data.investmentAmount.toString().replace(/,/g, "")) * 10000;
    if (stockPrice > 0 && investmentAmount > 0) {
      const totalShares = Math.floor(investmentAmount / stockPrice);
      const purchasableShares =
        Math.floor(totalShares / unitShares) * unitShares;

      if (purchasableShares > 0) {
        const requiredInvestment = purchasableShares * stockPrice; // 必要な投資金額の計算
        setResult(
          `購入可能株数は、${purchasableShares.toLocaleString()}株です。\n投資金額は、${requiredInvestment.toLocaleString()}円となります。`
        );
      } else {
        const minimumRequiredInvestment = stockPrice * unitShares; // 最低限必要な投資金額の計算
        setResult(
          `投資金額が足りないため、株を購入することができません。\n最低限 ${minimumRequiredInvestment.toLocaleString()}円の投資金額が必要です。`
        );
      }
    } else if (investmentAmount <= 0) {
      setResult("投資金額を正しく入力してください。");
    } else if (stockPrice <= 0) {
      setResult("株価を正しく入力してください。");
    }
  };

  return (
    <ChakraProvider>
      <Box p={4}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={4}>
            <Text fontWeight="bold" fontSize="xl">
              投資金額から株数計算スール
            </Text>
            <Text fontSize="sm">
              ※株数は<b>100株単位</b>で計算されます。
            </Text>
            <InputGroup>
              <Controller
                name="investmentAmount"
                control={control}
                render={({ field }) => (
                  <Flex>
                    <Center>
                      <Text w={20}>投資金額</Text>
                      <Input {...field} maxW="100px" />
                    </Center>
                  </Flex>
                )}
              />
              <InputRightAddon children="万円" />
            </InputGroup>
            <InputGroup>
              <Controller
                name="stockPrice"
                control={control}
                render={({ field }) => (
                  <Flex>
                    <Center>
                      <Text w={20}>株価</Text>
                      <Input {...field} maxW="115px" />
                    </Center>
                  </Flex>
                )}
              />
              <InputRightAddon children="円" />
            </InputGroup>
            <Button w="100px" colorScheme="blue" type="submit">
              株数計算
            </Button>
          </Stack>
        </form>
        {result && (
          <Text mt={4} whiteSpace="pre-wrap">
            {result}
          </Text>
        )}
      </Box>
    </ChakraProvider>
  );
};

export default App;
