import type { Database } from "@/lib/database.types";

export type NotificationType = Database["public"]["Enums"]["notification_type"];
export type NotificationStatus = Database["public"]["Enums"]["notification_status"];

/** O notificare (incercare de trimitere email), asa cum e persistata in `notifications`. */
export interface NotificationRecord {
  id: string;
  organizationId: string;
  recipientEmail: string;
  type: NotificationType;
  subject: string;
  body: string;
  relatedOrderId: string | null;
  status: NotificationStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}
