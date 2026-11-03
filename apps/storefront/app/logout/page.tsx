"use client";
import { useEffect } from "react";
import { Text } from "@chakra-ui/react";
import { api, setToken } from "@/lib/api";

export default function Logout() {
  useEffect(() => { api("/auth/logout", { method: "POST" }).catch(() => null).finally(() => { setToken(null); location.href = "/"; }); }, []);
  return <Text color="gray.600">Logging out…</Text>;
}
