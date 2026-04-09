import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ToneProfile } from "@/types/tone-profile";

type ToneProfileCardProps = {
  readonly profile: ToneProfile;
};

const FORMALITY_LABELS: Record<ToneProfile["formality_level"], string> = {
  formal: "Formell",
  "semi-formal": "Semi-formell",
  informal: "Informell",
};

const SENTENCE_LABELS: Record<ToneProfile["sentence_length"], string> = {
  short: "Kurz",
  medium: "Mittel",
  long: "Lang",
};

const VOCABULARY_LABELS: Record<ToneProfile["vocabulary_complexity"], string> =
  {
    simple: "Einfach",
    moderate: "Mittel",
    advanced: "Fortgeschritten",
  };

export function ToneProfileCard({ profile }: ToneProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Erkanntes Tonprofil</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Formalitaet</span>
            <p className="font-medium">
              {FORMALITY_LABELS[profile.formality_level]}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Satzlaenge</span>
            <p className="font-medium">
              {SENTENCE_LABELS[profile.sentence_length]}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Begruessung</span>
            <p className="font-medium">{profile.greeting_style}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Abschluss</span>
            <p className="font-medium">{profile.closing_style}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Stil</span>
            <p className="font-medium">
              {VOCABULARY_LABELS[profile.vocabulary_complexity]}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Emotionaler Ton</span>
            <p className="font-medium">{profile.emotional_tone}</p>
          </div>
        </div>

        {profile.typical_phrases.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">
              Typische Phrasen
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.typical_phrases.map((phrase) => (
                <Badge key={phrase} variant="secondary">
                  {phrase}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.avoidances.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">Vermeidungen</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.avoidances.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
