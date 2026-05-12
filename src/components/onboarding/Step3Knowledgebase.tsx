import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Step3KnowledgebaseProps = {
  readonly value: string;
  readonly onUpdate: (data: { knowledgebase: string }) => void;
  readonly onNext: () => void;
};

const PLACEHOLDER =
  "Beschreiben Sie hier Ihr Unternehmen, Ihre Produkte und Dienstleistungen, typische Kundenfragen, und alles was die KI wissen sollte, um qualitativ hochwertige Antworten zu schreiben.";

export function Step3Knowledgebase({
  value,
  onUpdate,
  onNext,
}: Step3KnowledgebaseProps) {
  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onUpdate({ knowledgebase: e.target.value });
  }

  function handleContinue() {
    onNext();
  }

  return (
    <div
      className="rounded-[25px] bg-white p-8 shadow-sm"
      style={{ fontFamily: "Archivo, sans-serif" }}
    >
      <h2 className="mb-1 text-xl font-semibold text-gray-900">Wissensbasis</h2>
      <p className="mb-6 text-sm text-gray-500">
        Geben Sie der KI Kontext über Ihr Unternehmen. Je mehr Informationen,
        desto besser werden die automatisch erstellten Antworten.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="knowledgebase">Über Ihr Unternehmen</Label>
          <Textarea
            id="knowledgebase"
            className="min-h-[160px] resize-y bg-gray-100 text-sm"
            rows={6}
            placeholder={PLACEHOLDER}
            value={value}
            onChange={handleChange}
          />
          <p className="text-xs text-gray-400">
            Optional — Sie können dieses Feld später unter Einstellungen
            ergänzen.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            className="rounded-full bg-[#CC00FF] px-6 text-white hover:bg-[#CC00FF]/90"
            onClick={handleContinue}
          >
            Weiter
          </Button>
        </div>
      </div>
    </div>
  );
}
