import { pictureSource } from "../lib/content";

interface PictureProps {
  name: string;
  label?: string;
  size?: "s" | "m" | "l" | "xl";
}

export function Picture({ name, label = "", size = "m" }: PictureProps) {
  return (
    <img
      class={`picture picture-${size}`}
      src={pictureSource(name)}
      alt={label}
      decoding="async"
      loading="lazy"
      draggable={false}
    />
  );
}
