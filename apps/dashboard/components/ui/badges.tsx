import { Badge } from "@chakra-ui/react";

// Three accents only: red = block, green = allow, blue = review. Everything else is gray.
const ACTION: Record<string, string> = { allow: "green", review: "blue", block: "red" };
const SEV: Record<string, string> = { critical: "red", high: "red", medium: "blue", low: "gray", none: "gray" };

export const ActionBadge = ({ action }: { action: string }) => (
  <Badge colorPalette={ACTION[action] ?? "gray"} variant="subtle" textTransform="uppercase" fontWeight="semibold" letterSpacing="wide">{action}</Badge>
);
export const SeverityBadge = ({ severity }: { severity: string }) => (
  <Badge colorPalette={SEV[severity] ?? "gray"} variant="subtle" textTransform="uppercase">{severity}</Badge>
);
export const GroupBadge = ({ group }: { group: string }) => (
  <Badge colorPalette="gray" variant="outline">{group}</Badge>
);
