import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/studio/Studio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Get-the-Market.ai — Find your first customers" },
      { name: "description", content: "Tell us what you sell. Watch your first sales email write itself, chapter by chapter." },
      { property: "og:title", content: "Get-the-Market.ai — Find your first customers" },
      { property: "og:description", content: "Tell us what you sell. Watch your first sales email write itself, chapter by chapter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});
