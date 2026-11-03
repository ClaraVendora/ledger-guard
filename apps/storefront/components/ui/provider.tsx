"use client";
import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

const config = defineConfig({
  globalCss: {
    body: { bg: "#faf7f2", color: "#1f1a17" },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "Georgia, 'Iowan Old Style', serif" },
        body: { value: "Georgia, 'Iowan Old Style', serif" },
      },
      colors: {
        brand: { 500: { value: "#2f5d3a" }, 600: { value: "#264b2f" } },
        warm: { 500: { value: "#b4552a" }, 600: { value: "#95461f" } },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

export function Provider({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
