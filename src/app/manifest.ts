import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Meu próximo game",
    short_name: "Próximo game",
    description: "Recomendações de jogos Steam com IA",
    start_url: "/pt-BR",
    scope: "/",
    display: "standalone",
    background_color: "#0c0618",
    theme_color: "#6d28d9",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
