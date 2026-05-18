const DEFAULTS = {
  maxWidth:  1920,
  maxHeight: 1920,
  quality:   0.78,
  mimeType:  'image/jpeg',
};

export async function compressImage(file, options = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;

  const opt = { ...DEFAULTS, ...options };

  const dataUrl = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });

  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Failed to decode image'));
    im.src = dataUrl;
  });

  let { width, height } = img;
  const scale = Math.min(1, opt.maxWidth / width, opt.maxHeight / height);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width  = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(img, 0, 0, tw, th);

  const blob = await new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), opt.mimeType, opt.quality)
  );

  const originalName = file.name || `image_${Date.now()}.jpg`;
  const newName      = originalName.replace(/\.\w+$/, '.jpg');
  return new File([blob], newName, { type: opt.mimeType, lastModified: Date.now() });
}

export async function compressVideo(file) {
  return file;
}
