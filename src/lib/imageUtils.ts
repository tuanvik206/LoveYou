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
    // Nếu file đã nhỏ hơn 300KB thì không cần resize
    if (file.size < 300 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const resizedName = file.name.replace(/\.[^.]+$/, ".jpg");
            resolve(new File([blob], resizedName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target!.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
