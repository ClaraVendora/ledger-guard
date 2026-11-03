"use client";
import { Alert, Box, Field, Heading, Input, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export const Card = ({ children, ...rest }: { children: ReactNode } & Record<string, unknown>) => (
  <Box bg="white" borderWidth="1px" rounded="lg" p="4" {...rest}>{children}</Box>
);

export const PageTitle = ({ title, sub }: { title: string; sub?: ReactNode }) => (
  <Box mb="6">
    <Heading size="2xl" fontWeight="semibold" mb="1">{title}</Heading>
    {sub && <Text color="gray.600">{sub}</Text>}
  </Box>
);

export const H2 = ({ children }: { children: ReactNode }) => <Heading size="md" mt="6" mb="3">{children}</Heading>;

export function Notice({ kind, children }: { kind: "ok" | "err" | "info"; children: ReactNode }) {
  const status = kind === "ok" ? "success" : kind === "err" ? "error" : "warning";
  return (
    <Alert.Root status={status} mb="4" fontFamily="system-ui, sans-serif" fontSize="sm">
      <Alert.Indicator />
      <Alert.Content><Alert.Description>{children}</Alert.Description></Alert.Content>
    </Alert.Root>
  );
}

export function TextField({ label, value, onChange, type = "text", ...rest }: { label: string; value: string | number; onChange: (v: string) => void; type?: string } & Record<string, unknown>) {
  return (
    <Field.Root mb="3" fontFamily="system-ui, sans-serif" {...rest}>
      <Field.Label fontSize="sm" color="gray.600">{label}</Field.Label>
      <Input bg="white" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field.Root>
  );
}
