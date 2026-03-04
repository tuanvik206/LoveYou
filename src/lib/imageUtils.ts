/**
 * Resize image trước khi upload để tiết kiệm băng thông
 * - maxSize: chiều lớn nhất (px), mặc định 1280
 * - quality: chất lượng JPEG 0–1, mặc định 0.82
 */
export function resizeImage(
  file: File,
  maxSize = 1280,
  quality = 0.82,
): Promise<File> {
  return new Promise((resolve) => {
    // Luôn convert qua canvas → JPEG để xử lý HEIC/HEIF từ iOS
    // (không dùng early-return vì sẽ giữ nguyên định dạng không hiển thị được)
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width >= height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Ảnh nhỏ (<300KB gốc) dùng quality cao hơn để không mất nét
      const q = file.size < 300 * 1024 ? 0.92 : quality;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, ".jpg");
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        q,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Fallback: nếu browser không đọc được (HEIC trên Chrome/Android)
      // thử qua FileReader
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img2 = new Image();
        img2.onload = () => {
          let { width, height } = img2;
          if (width > maxSize || height > maxSize) {
            if (width >= height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img2, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              resolve(
                new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                  type: "image/jpeg",
                }),
              );
            },
            "image/jpeg",
            quality,
          );
        };
        img2.onerror = () => resolve(file);
        img2.src = ev.target!.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}
