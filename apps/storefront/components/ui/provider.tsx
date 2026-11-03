"use client";
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import type { ReactNode } from "react";

// Neutral theme: white background, gray scale, black text.
// Accents are Chakra's standard palettes only: red (block), green (allow), blue (review, links).
const config = defineConfig({
  globalCss: {
    html: { colorScheme: "light" },
    body: { bg: "white", color: "gray.900" },
  },
  theme: {
    semanticTokens: {
      colors: {
        allow: { value: "{colors.green.600}" },
        review: { value: "{colors.blue.600}" },
        block: { value: "{colors.red.600}" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

export function Provider({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
