import {
  ChakraProvider,
  Box,
  Button,
  VStack,
  Text,
  InputRightAddon,
  InputGroup,
  NumberInput,
  NumberInputField,
} from "@chakra-ui/react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";

type FormData = {
  unitShares: number;
  stockPrice: number;
  investmentAmount: number;
};

const App = () => {
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      unitShares: 100,
      stockPrice: 0,
      investmentAmount: 0,
    },
  });
  const [result, setResult] = useState("");

  const onSubmit = (data: FormData) => {
    const { unitShares, stockPrice, investmentAmount } = data;

    if (stockPrice > 0) {
      const totalShares = Math.floor(investmentAmount / stockPrice);
      const purchasableShares =
        Math.floor(totalShares / unitShares) * unitShares;
      const requiredInvestment = purchasableShares * stockPrice; // 必要な投資金額の計算

      setResult(
        `購入可能株数: ${purchasableShares} 株（投資額: ${requiredInvestment}円）`
      );
    } else {
      setResult("株価を正しく入力してください。");
    }
  };

  return (
    <ChakraProvider>
      <Box p={4}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={4}>
            <Text fontSize="xl">投資額から株数計算スール</Text>
            <InputGroup justifyContent="center">
              <Controller
                name="unitShares"
                control={control}
                render={({ field }) => (
                  <NumberInput defaultValue={100}>
                    <NumberInputField {...field} placeholder="株数" />
                  </NumberInput>
                )}
              />
              <InputRightAddon children="株" />
            </InputGroup>
            <InputGroup justifyContent="center">
              <Controller
                name="stockPrice"
                control={control}
                render={({ field }) => (
                  <NumberInput>
                    <NumberInputField {...field} placeholder="株価" />
                  </NumberInput>
                )}
              />
              <InputRightAddon children="円" />
            </InputGroup>
            <InputGroup justifyContent="center">
              <Controller
                name="investmentAmount"
                control={control}
                render={({ field }) => (
                  <NumberInput>
                    <NumberInputField {...field} placeholder="投資額" />
                  </NumberInput>
                )}
              />
              <InputRightAddon children="円" />
            </InputGroup>
            <Button colorScheme="blue" type="submit">
              計算
            </Button>
          </VStack>
        </form>
        {result && (
          <Text textAlign="center" mt={4}>
            {result}
          </Text>
        )}
      </Box>
    </ChakraProvider>
  );
};

export default App;
