"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 p-8">
      <p role="alert">Unable to load the weekly plan. Planning requires the local development server and its provider configuration.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
