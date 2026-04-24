import { DemoPlayground } from "./demo-playground";

export const metadata = {
  title: "Demo — Design system",
};

export default function DemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 p-6 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-gold">
          Design system playground
        </h1>
        <p className="text-cream/70">
          Variantes de Button, LifeBar, Timer, QuestionCard, AnswerButton.
          Page temporaire utilisée pendant le dev.
        </p>
      </header>

      <DemoPlayground />
    </main>
  );
}
