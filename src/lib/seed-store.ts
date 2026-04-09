import { useEmailStore } from "@/lib/store/email-store";
import {
  mockSpamEmails,
  mockAdEmails,
  mockUrgentDrafts,
  mockOtherDrafts,
  mockEscalations,
  mockUnsubscribes,
} from "@/lib/mock-data";

export function seedStore(): void {
  const { addEmail } = useEmailStore.getState();

  const allEmails = [
    ...mockSpamEmails,
    ...mockAdEmails,
    ...mockUrgentDrafts,
    ...mockOtherDrafts,
    ...mockEscalations,
    ...mockUnsubscribes,
  ];

  for (const email of allEmails) {
    addEmail(email);
  }
}
