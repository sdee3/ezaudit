import { extendTheme } from '@chakra-ui/react'

export const theme = extendTheme({
  colors: {
    primary: '#1976d2',
    primaryDark: '#004ba0',
    primaryLight: '#63a4ff',
    black: '#000',
    gray300: '#333',
    gray600: '#666',
    gray900: '#999',
    white: '#fff',
  },
  fonts: {
    body: 'Open Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Ubuntu, Cantarell, sans-serif',
    heading:
      'Open Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Ubuntu, Cantarell, sans-serif',
  },
})
