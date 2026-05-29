import React from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  BOOKING_STATUS_COLOR,
  BOOKING_STATUS_LABEL,
  type BookingStatus,
} from '@/helpers/enums/booking-status';

export function BookingStatusBadge({ status }: { status: string }) {
  const s = status as BookingStatus;
  const color = BOOKING_STATUS_COLOR[s] ?? { bg: '#eee', fg: '#444' };
  const label = BOOKING_STATUS_LABEL[s] ?? status;
  return <Badge bg={color.bg} fg={color.fg}>{label}</Badge>;
}
