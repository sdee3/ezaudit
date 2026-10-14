import { createContext, useState } from 'react'

interface PrintContextInterface {
  isPrinting: boolean
  setIsPrinting: (value: boolean) => void
}

export const PrintContext = createContext<PrintContextInterface>({
  isPrinting: false,
  setIsPrinting: () => null,
})

export const usePrintContext = () => {
  const [isPrinting, setIsPrinting] = useState(false)

  return { PrintContext, isPrinting, setIsPrinting }
}
