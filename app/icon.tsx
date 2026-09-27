import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/logo";

const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((s) => ({
    id: String(s),
    size: { width: s, height: s },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  return new ImageResponse(<LogoMark size={size} />, { width: size, height: size });
}
