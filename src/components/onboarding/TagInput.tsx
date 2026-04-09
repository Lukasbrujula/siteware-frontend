import type { ChangeEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

type TagInputProps = {
  readonly id: string;
  readonly tags: readonly string[];
  readonly onChange: (tags: readonly string[]) => void;
  readonly placeholder?: string;
};

export function TagInput({
  id,
  tags,
  onChange,
  placeholder = "Eingabe + Enter",
}: TagInputProps) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = input.trim();
      if (value !== "" && !tags.includes(value)) {
        onChange([...tags, value]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleRemove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="text-gray-400 hover:text-gray-600"
              aria-label={`${tag} entfernen`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        id={id}
        className="bg-gray-100"
        placeholder={placeholder}
        value={input}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setInput(e.target.value)
        }
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
