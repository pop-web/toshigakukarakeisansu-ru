import { useState } from "react";
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
  Flex,
  Center,
  InputRightElement,
  IconButton,
} from "@chakra-ui/react";
import { useForm, Controller } from "react-hook-form";
import { SmallCloseIcon } from "@chakra-ui/icons";

type FormData = {
  stockPrice: number;
  investmentAmount: number;
};

const App = () => {
  const { control, handleSubmit, setValue, getValues } = useForm<FormData>({
    defaultValues: {
      stockPrice: 0,
      investmentAmount: 0,
    },
  });
  const [result, setResult] = useState("");
  const [showClearButton, setShowClearButton] = useState(false);
  const addAmount = (amount: number) => {
    const currentAmount = getValues("investmentAmount");
    setValue("investmentAmount", currentAmount + amount);
  };

  const onSubmit = (data: FormData) => {
    const unitShares = 100; // 単元株を固定値として設定

    // カンマを取り除いて数値に変換
    const stockPrice = parseFloat(data.stockPrice.toString().replace(/,/g, ""));
    const investmentAmount = parseFloat(
      data.investmentAmount.toString().replace(/,/g, "")
    );

    if (stockPrice > 0 && investmentAmount > 0) {
      const totalShares = Math.floor(investmentAmount / stockPrice);
      const purchasableShares =
        Math.floor(totalShares / unitShares) * unitShares;

      if (purchasableShares > 0) {
        const requiredInvestment = purchasableShares * stockPrice; // 必要な投資金額の計算
        setResult(
          `購入可能株数： ${purchasableShares} 株（投資金額： ${requiredInvestment}円）`
        );
      } else {
        setResult("投資金額が足りないため、株を購入することができません。");
      }
    } else if (stockPrice <= 0) {
      setResult("株価を正しく入力してください。");
    } else if (investmentAmount <= 0) {
      setResult("投資金額を正しく入力してください。");
    }
  };

  const clearInvestmentAmount = () => {
    setValue("investmentAmount", 0);
  };

  const handleInvestmentAmountChange = (value: string) => {
    const numericValue = parseFloat(value.replace(/,/g, ""));
    setValue("investmentAmount", numericValue);
    setShowClearButton(numericValue > 0);
  };

  return (
    <ChakraProvider>
      <Box p={4}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={4}>
            <Text fontSize="xl">投資金額から株数計算スール</Text>
            <InputGroup justifyContent="center">
              <Controller
                name="investmentAmount"
                control={control}
                render={({ field }) => (
                  <Flex>
                    <Center>
                      <Text w={20} textAlign="right">
                        投資金額：
                      </Text>
                      <NumberInput
                        value={field.value}
                        onChange={(value) =>
                          handleInvestmentAmountChange(value)
                        }
                      >
                        <NumberInputField {...field} />

                        {showClearButton && (
                          <InputRightElement width="2.5rem">
                            <IconButton
                              size={"xs"}
                              isRound={true}
                              variant="solid"
                              aria-label="Done"
                              fontSize="10px"
                              icon={<SmallCloseIcon />}
                              onClick={clearInvestmentAmount}
                            />
                          </InputRightElement>
                        )}
                      </NumberInput>
                    </Center>
                  </Flex>
                )}
              />
              <InputRightAddon children="円" />
            </InputGroup>
            <InputGroup justifyContent="center" gap={1}>
              <Button width="100px" onClick={() => addAmount(100000)}>
                +10万
              </Button>
              <Button width="100px" onClick={() => addAmount(1000000)}>
                +100万
              </Button>
              <Button width="100px" onClick={() => addAmount(10000000)}>
                +1000万
              </Button>
            </InputGroup>
            <InputGroup justifyContent="center">
              <Controller
                name="stockPrice"
                control={control}
                render={({ field }) => (
                  <Flex>
                    <Center>
                      <Text w={20} textAlign="right">
                        株価：
                      </Text>
                      <NumberInput defaultValue={0}>
                        <NumberInputField {...field} />
                      </NumberInput>
                    </Center>
                  </Flex>
                )}
              />
              <InputRightAddon children="円" />
            </InputGroup>
            <Button colorScheme="blue" type="submit">
              株数計算
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
