"use client";

import "react-image-gallery/styles/image-gallery.css";
import { useEffect } from "react";
import ImageGallery from "react-image-gallery";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const items = images.map((url) => ({
    original: url,
    thumbnail: url,
    originalAlt: "ảnh",
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full max-w-3xl px-4">
          <ImageGallery
            items={items}
            startIndex={startIndex}
            showPlayButton={false}
            showFullscreenButton={false}
            showThumbnails={images.length > 1}
            showNav={images.length > 1}
            infinite={false}
            additionalClass="rig-lightbox"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
