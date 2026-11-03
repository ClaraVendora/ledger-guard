"use client";
import { useEffect, useState } from "react";
import { Button, Input, Link, Table, Text } from "@chakra-ui/react";
import { api, getCart, setCart, money, type Product, type CartItem } from "@/lib/api";
import { Card, PageTitle } from "@/components/ui/bits";

export default function Cart() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setC] = useState<CartItem[]>([]);
  useEffect(() => { api<Product[]>("/products").then(setProducts); setC(getCart()); }, []);
  const update = (sku: string, qty: number) => { const c = getCart().map((i) => (i.sku === sku ? { ...i, qty } : i)).filter((i) => i.qty > 0); setCart(c); setC(c); };
  const preset = () => { const c = [{ sku: "WINE-BAROLO-21", qty: 3 }, { sku: "SPIRIT-MEZCAL", qty: 2 }, { sku: "MEAT-WAGYU", qty: 1 }]; setCart(c); setC(c); };
  const total = cart.reduce((a, i) => a + (products.find((p) => p.sku === i.sku)?.price ?? 0) * i.qty, 0);
  return (
    <>
      <PageTitle title="Your cart" sub={<>{cart.length ? `${cart.reduce((a, i) => a + i.qty, 0)} items` : "Empty."} <Link onClick={preset} textDecoration="underline" cursor="pointer" fontFamily="system-ui, sans-serif" fontSize="sm">load the wine order</Link></>} />
      <Card>
        <Table.Root size="sm" fontFamily="system-ui, sans-serif">
          <Table.Body>
            {cart.map((i) => { const p = products.find((x) => x.sku === i.sku); return (
              <Table.Row key={i.sku}><Table.Cell>{p?.name ?? i.sku}</Table.Cell><Table.Cell><Input size="xs" type="number" min={0} width="64px" value={i.qty} onChange={(e) => update(i.sku, Number(e.target.value))} /></Table.Cell><Table.Cell textAlign="right">{money((p?.price ?? 0) * i.qty)}</Table.Cell></Table.Row>
            ); })}
            <Table.Row><Table.Cell colSpan={2}><Text fontWeight="semibold">Total</Text></Table.Cell><Table.Cell textAlign="right"><Text fontWeight="semibold">{money(total)}</Text></Table.Cell></Table.Row>
          </Table.Body>
        </Table.Root>
        <Button asChild mt="3" bg="brand.500" color="white" _hover={{ bg: "brand.600" }} size="sm"><a href="/checkout">Checkout</a></Button>
      </Card>
    </>
  );
}
