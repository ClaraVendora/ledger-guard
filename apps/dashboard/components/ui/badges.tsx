import { Badge } from "@chakra-ui/react";

const ACTION: Record<string, string> = { allow: "green", review: "yellow", block: "red" };
const SEV: Record<string, string> = { critical: "red", high: "orange", medium: "yellow", low: "gray", none: "gray" };
const GROUP: Record<string, string> = { issuance: "blue", load: "teal", takeover: "red", laundering: "purple" };

export const ActionBadge = ({ action }: { action: string }) => (
  <Badge colorPalette={ACTION[action] ?? "gray"} variant="subtle" textTransform="uppercase" fontWeight="semibold" letterSpacing="wide">{action}</Badge>
);
export const SeverityBadge = ({ severity }: { severity: string }) => (
  <Badge colorPalette={SEV[severity] ?? "gray"} variant="subtle" textTransform="uppercase">{severity}</Badge>
);
export const GroupBadge = ({ group }: { group: string }) => (
  <Badge colorPalette={GROUP[group] ?? "gray"} variant="subtle">{group}</Badge>
);
