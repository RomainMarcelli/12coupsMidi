"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LifeBar, type LifeState } from "@/components/game/LifeBar";
import { Timer } from "@/components/game/Timer";
import { QuestionCard } from "@/components/game/QuestionCard";
import {
  AnswerButton,
  type AnswerState,
} from "@/components/game/AnswerButton";

const LIFE_STATES: LifeState[] = ["green", "yellow", "red"];
const ANSWER_STATES: AnswerState[] = ["idle", "correct", "wrong"];

export function DemoPlayground() {
  const [life, setLife] = useState<LifeState>("green");
  const [timerKey, setTimerKey] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [questionKey, setQuestionKey] = useState(0);

  return (
    <div className="flex flex-col gap-10">
      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button variant="gold">Gold principal</Button>
          <Button variant="buzz">Buzz rouge</Button>
          <Button variant="ghost-gold">Ghost or</Button>
          <Button variant="default">Default (shadcn)</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="gold" size="sm">Small</Button>
          <Button variant="gold" size="default">Default</Button>
          <Button variant="gold" size="lg">Large</Button>
          <Button variant="gold" size="icon">
            <Play className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Section>

      <Section title="shadcn Card / Input / Badge / Progress">
        <Card>
          <CardHeader>
            <CardTitle>Exemple de card</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input placeholder="Input shadcn…" />
            <div className="flex gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
            <Progress value={64} className="w-full" />
          </CardContent>
        </Card>
      </Section>

      <Section title="LifeBar">
        <div className="flex items-center gap-6">
          <LifeBar state={life} />
          <div className="flex gap-2">
            {LIFE_STATES.map((s) => (
              <Button
                key={s}
                variant={s === life ? "gold" : "ghost-gold"}
                size="sm"
                onClick={() => setLife(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Timer">
        <div className="flex items-center gap-6">
          <Timer
            key={timerKey}
            duration={10}
            onEnd={() => {
              /* demo */
            }}
            paused={timerPaused}
          />
          <div className="flex flex-col gap-2">
            <Button
              variant="gold"
              size="sm"
              onClick={() => setTimerKey((k) => k + 1)}
            >
              Reset (10 s)
            </Button>
            <Button
              variant="ghost-gold"
              size="sm"
              onClick={() => setTimerPaused((p) => !p)}
            >
              {timerPaused ? "Reprendre" : "Pause"}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="QuestionCard">
        <div className="flex flex-col gap-3">
          <QuestionCard
            keyId={questionKey}
            category="Histoire"
            categoryColor="#F5C518"
            difficulte={3}
            enonce="En quelle année a eu lieu le débarquement de Normandie ?"
          />
          <Button
            variant="ghost-gold"
            size="sm"
            className="self-start"
            onClick={() => setQuestionKey((k) => k + 1)}
          >
            Rejouer l'animation
          </Button>
        </div>
      </Section>

      <Section title="AnswerButton — 3 états">
        <div className="grid gap-3 sm:grid-cols-2">
          <AnswerButton state={answerState} keyHint="A">
            1944
          </AnswerButton>
          <AnswerButton state="idle" keyHint="B">
            1945
          </AnswerButton>
        </div>
        <div className="flex gap-2">
          {ANSWER_STATES.map((s) => (
            <Button
              key={s}
              variant={s === answerState ? "gold" : "ghost-gold"}
              size="sm"
              onClick={() => setAnswerState(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card/50 p-6">
      <h2 className="font-display text-xl font-bold text-navy">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
