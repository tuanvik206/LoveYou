"use client";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

interface Props {
  images: string[];
  startIndex?: number;
  onClose: () => void;
}

export default function ImageLightbox({
  images,
  startIndex = 0,
  onClose,
}: Props) {
  const slides = images.map((url) => ({ src: url }));

  return (
    <Lightbox
      open={true}
      close={onClose}
      index={startIndex}
      slides={slides}
      plugins={[Zoom]}
      animation={{ fade: 250 }}
      controller={{ closeOnBackdropClick: true }}
      carousel={{ padding: 0, spacing: "30%" }}
      styles={{
        container: { backgroundColor: "rgba(0, 0, 0, 0.95)" },
      }}
    />
  );
}
