"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";

type Props = Omit<ImageProps, "src"> & { src: string; fallbackSrc?: string };

export default function AvatarImage({ src, fallbackSrc = "/player-placeholder.jpg", alt, ...rest }: Props) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <Image
      {...rest}
      alt={alt}
      src={imgSrc}
      onError={() => {
        if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
      }}
    />
  );
}
