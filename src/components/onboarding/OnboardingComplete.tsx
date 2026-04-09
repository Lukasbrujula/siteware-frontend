import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { ToneProfileCard } from "./ToneProfileCard";
import type { ToneProfile } from "@/types/tone-profile";

type OnboardingCompleteProps = {
  readonly profile: ToneProfile;
  readonly imapHost: string;
  readonly sentFolder: string;
};

export function OnboardingComplete({
  profile,
  imapHost,
  sentFolder,
}: OnboardingCompleteProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Einrichtung abgeschlossen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg font-medium">
            Ihre E-Mail-Automatisierung ist bereit!
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">IMAP-Server</span>
              <p className="font-medium">{imapHost}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Gesendet-Ordner</span>
              <p className="font-medium">{sentFolder}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ToneProfileCard profile={profile} />

      <Button asChild className="w-full">
        <Link to="/">Zum Dashboard</Link>
      </Button>
    </div>
  );
}
