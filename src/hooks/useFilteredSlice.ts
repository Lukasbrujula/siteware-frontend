import { useEmailStore } from "@/lib/store/email-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { CategorySlice, SliceEmailMap } from "@/types/email";

/**
 * Returns the requested email-store slice, filtered by the currently
 * selected inbox in the ui-store. When `selectedInboxId` is `null`
 * (the "Alle Posteingänge" reset), the slice is returned unchanged.
 */
export function useFilteredSlice<S extends CategorySlice>(
  slice: S,
): readonly SliceEmailMap[S][] {
  const emails = useEmailStore(
    (state) => state[slice],
  ) as readonly SliceEmailMap[S][];
  const selectedInboxId = useUiStore((state) => state.selectedInboxId);

  if (selectedInboxId === null) return emails;
  return emails.filter((e) => {
    const inboxId = (e as { inbox_id?: string | null }).inbox_id;
    return inboxId === selectedInboxId;
  });
}
