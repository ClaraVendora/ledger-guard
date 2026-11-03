"use client";
import { useEffect, useState } from "react";
import { Button, Grid, GridItem, HStack, Text } from "@chakra-ui/react";
import { api, getCart, setCart, money, type Product } from "@/lib/api";
import { Card, PageTitle, Notice } from "@/components/ui/bits";

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => { api<Product[]>("/products").then(setProducts).catch(() => setProducts([])); }, []);
  const add = (sku: string) => {
    const c = getCart();
    const it = c.find((i) => i.sku === sku);
    if (it) it.qty += 1; else c.push({ sku, qty: 1 });
    setCart(c);
    setAdded(sku);
    setTimeout(() => setAdded(null), 900);
  };
  return (
    <>
      <PageTitle title="Wine, cheese and the good stuff" sub="Delivered across Brooklyn the same day. Pay with points, store credit, gift cards or card." />
      {products.length === 0 && <Notice kind="info">No products. Seed the merchant API from the dashboard's demo control.</Notice>}
      <Grid templateColumns="repeat(12, 1fr)" gap="4">
        {products.map((p) => (
          <GridItem key={p.sku} colSpan={{ base: 12, sm: 6, md: 4 }}><Card h="100%">
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="wider" color="gray.500">{p.category}</Text>
            <Text fontSize="lg" my="1">{p.name}</Text>
            <HStack mt="2">
              <Text fontWeight="semibold">{money(p.price)}</Text>
              <Text flex="1" />
              <Button size="sm" colorPalette="gray" variant="solid" onClick={() => add(p.sku)}>{added === p.sku ? "Added" : "Add"}</Button>
            </HStack>
          </Card></GridItem>
        ))}
      </Grid>
    </>
  );
}
