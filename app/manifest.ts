import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wealth Tracker",
    short_name: "Wealth",
    description: "Personal net-worth dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#080c18",
    theme_color: "#080c18",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
