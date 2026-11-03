"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Heading, HStack, Input, Text } from "@chakra-ui/react";

export default function Accounts() {
  const [id, setId] = useState("cus_dana");
  const router = useRouter();
  return (
    <>
      <Heading size="lg" mb="1">Accounts</Heading>
      <Text color="gray.500" mb="5">Open a customer's stored-value activity and risk history. Demo accounts: cus_dana (victim), cus_mule (mule), cus_sam (control).</Text>
      <form onSubmit={(e) => { e.preventDefault(); router.push(`/accounts/${id}`); }}>
        <HStack maxW="420px">
          <Input fontFamily="mono" value={id} onChange={(e) => setId(e.target.value)} placeholder="customer id" />
          <Button type="submit" colorPalette="gray">Open</Button>
        </HStack>
      </form>
    </>
  );
}
