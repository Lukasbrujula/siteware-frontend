export type Anrede = "sie" | "du";

export type Sprachstil =
  | "professionell"
  | "formell"
  | "sachlich"
  | "komplex"
  | "einfach"
  | "konservativ"
  | "modern"
  | "wissenschaftlich"
  | "fachspezifisch"
  | "abstrakt"
  | "klar"
  | "direkt"
  | "rhetorisch"
  | "ausdrucksstark";

export type EmailLength =
  | "so-kurz-wie-moeglich"
  | "sehr-kurz"
  | "kurz"
  | "mittlerer-umfang"
  | "detailliert"
  | "umfangreich"
  | "sehr-detailliert";

export const SPRACHSTIL_OPTIONS: readonly {
  readonly value: Sprachstil;
  readonly label: string;
}[] = [
  { value: "professionell", label: "Professionell" },
  { value: "formell", label: "Formell" },
  { value: "sachlich", label: "Sachlich" },
  { value: "komplex", label: "Komplex" },
  { value: "einfach", label: "Einfach" },
  { value: "konservativ", label: "Konservativ" },
  { value: "modern", label: "Modern" },
  { value: "wissenschaftlich", label: "Wissenschaftlich" },
  { value: "fachspezifisch", label: "Fachspezifisch" },
  { value: "abstrakt", label: "Abstrakt" },
  { value: "klar", label: "Klar" },
  { value: "direkt", label: "Direkt" },
  { value: "rhetorisch", label: "Rhetorisch" },
  { value: "ausdrucksstark", label: "Ausdrucksstark" },
] as const;

export const EMAIL_LENGTH_OPTIONS: readonly {
  readonly value: EmailLength;
  readonly label: string;
}[] = [
  { value: "so-kurz-wie-moeglich", label: "So kurz wie möglich" },
  { value: "sehr-kurz", label: "Sehr kurz" },
  { value: "kurz", label: "Kurz" },
  { value: "mittlerer-umfang", label: "Mittlerer Umfang" },
  { value: "detailliert", label: "Detailliert" },
  { value: "umfangreich", label: "Umfangreich" },
  { value: "sehr-detailliert", label: "Sehr detailliert" },
] as const;

export type ToneProfile = {
  readonly tenant_id: string;
  readonly greeting_style: string;
  readonly closing_style: string;
  readonly formality_level: "formal" | "semi-formal" | "informal";
  readonly sentence_length: "short" | "medium" | "long";
  readonly vocabulary_complexity: "simple" | "moderate" | "advanced";
  readonly emotional_tone: string;
  readonly use_of_humor: boolean;
  readonly typical_phrases: readonly string[];
  readonly avoidances: readonly string[];
  readonly industry_jargon: readonly string[];
  readonly language: "de" | "en";
  readonly created_at: string;
  readonly updated_at: string;
  // Siteware platform fields
  readonly anrede?: Anrede;
  readonly sprachstil?: readonly Sprachstil[];
  readonly email_length?: EmailLength;
};

export type AnalyzeRequest = {
  readonly tenant_id: string;
  readonly example_emails: readonly string[];
  readonly language: "de" | "en";
};
