import { ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { useUiStore } from "@/lib/store/ui-store";

const ALL_INBOXES_VALUE = "__all__";

export function InboxFilter() {
  const inboxes = useUiStore((state) => state.inboxes);
  const selectedInboxId = useUiStore((state) => state.selectedInboxId);
  const setSelectedInboxId = useUiStore((state) => state.setSelectedInboxId);

  if (inboxes.length === 0) return null;

  const value = selectedInboxId ?? ALL_INBOXES_VALUE;
  const selectedLabel =
    selectedInboxId === null
      ? "Alle Posteingänge"
      : (inboxes.find((i) => i.id === selectedInboxId)?.label ??
        "Alle Posteingänge");

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => {
        setSelectedInboxId(next === ALL_INBOXES_VALUE ? null : next);
      }}
    >
      <SelectPrimitive.Trigger
        aria-label="Posteingang auswählen"
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <SelectPrimitive.Value>{selectedLabel}</SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <SelectPrimitive.Viewport>
            <SelectPrimitive.Item
              value={ALL_INBOXES_VALUE}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
            >
              <SelectPrimitive.ItemText>
                Alle Posteingänge
              </SelectPrimitive.ItemText>
            </SelectPrimitive.Item>
            {inboxes.map((inbox) => (
              <SelectPrimitive.Item
                key={inbox.id}
                value={inbox.id}
                className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <SelectPrimitive.ItemText>
                  {inbox.label}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
