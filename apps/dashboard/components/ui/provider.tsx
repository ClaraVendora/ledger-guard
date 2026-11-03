"use client";
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

const config = defineConfig({
  globalCss: {
    body: { bg: "bg", color: "fg" },
  },
  theme: {
    tokens: {
      colors: {
        brand: { 500: { value: "#5ad1b5" }, 600: { value: "#3fb89c" } },
      },
    },
    semanticTokens: {
      colors: {
        allow: { value: "#4fbf7a" },
        review: { value: "#e5b84b" },
        block: { value: "#ef5e6b" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

export function Provider({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
