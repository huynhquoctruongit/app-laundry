import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, type OrderStatus } from '@/helpers/enums/order-status';

export function OrderStatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  const color = ORDER_STATUS_COLOR[s] ?? { bg: '#eee', fg: '#444' };
  const label = ORDER_STATUS_LABEL[s] ?? status;
  return <Badge bg={color.bg} fg={color.fg}>{label}</Badge>;
}
