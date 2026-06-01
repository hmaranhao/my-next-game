import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Next Game",
    short_name: "Next Game",
    description: "Steam profile game recommendations powered by TensorFlow.js",
    start_url: "/pt-BR",
    display: "standalone",
    background_color: "#0c0618",
    theme_color: "#6d28d9",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/file.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
