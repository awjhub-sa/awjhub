/**
 * MediaLightbox — a photo or a video at full size.
 *
 * Shared, because every screen that lists field records ends up needing it and
 * a second copy is a second set of close-button bugs.
 */

import { X } from '@phosphor-icons/react';

export default function MediaLightbox({ src, type, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
        <X size={20} weight="regular" />
      </button>
      <div onClick={e => e.stopPropagation()} className="max-w-5xl w-full max-h-[90vh] flex items-center justify-center">
        {type === 'video'
          ? <video src={src} controls autoPlay className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
          : <img src={src} alt="" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
        }
      </div>
    </div>
  );
}
