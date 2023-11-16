import {
  ChakraProvider,
  Box,
  Button,
  NumberInput,
  NumberInputField,
  VStack,
  Text,
  InputRightAddon,
  InputGroup,
} from "@chakra-ui/react";
import { useState } from "react";

const App = () => {
  const [stockPrice, setStockPrice] = useState("");
  const [investmentAmount, setInvestmentAmount] = useState("");

  const handleCalculate = () => {
    // ここに株数を計算するロジックを追加します
    console.log("株価: ", stockPrice);
    console.log("投資金額: ", investmentAmount);
  };
  return (
    <ChakraProvider>
      <Box p={4}>
        <VStack spacing={4}>
          <Text fontSize="xl">投資金額から株数計算スール</Text>
          <InputGroup justifyContent="center">
            <NumberInput onChange={(valueString) => setStockPrice(valueString)}>
              <NumberInputField placeholder="株価" />
            </NumberInput>
            <InputRightAddon children="円" />
          </InputGroup>
          <InputGroup justifyContent="center">
            <NumberInput
              onChange={(valueString) => setInvestmentAmount(valueString)}
            >
              <NumberInputField placeholder="投資金額" />
            </NumberInput>
            <InputRightAddon children="円" />
          </InputGroup>
          <Button colorScheme="blue" onClick={handleCalculate}>
            計算
          </Button>
        </VStack>
      </Box>
    </ChakraProvider>
  );
};

export default App;
