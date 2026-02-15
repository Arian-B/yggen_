import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollCanvasProps {
  frameCount?: number;
  imagePathPrefix?: string; // e.g., "/assets/sequence/frame_"
  heightClass?: string; // Tailwind class for scroll height, e.g., "h-[500vh]"
}

const ScrollCanvas: React.FC<ScrollCanvasProps> = ({ 
  frameCount = 300, 
  imagePathPrefix,
  heightClass = "h-[500vh]" 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Preload images in batches
  useEffect(() => {
    if (!imagePathPrefix) {
      setImagesLoaded(true);
      return;
    }

    const loadBatch = async (startIndex: number, batchSize: number) => {
      const promises: Promise<HTMLImageElement>[] = [];
      for (let i = startIndex; i < Math.min(startIndex + batchSize, frameCount); i++) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.src = `${imagePathPrefix}${i.toString().padStart(4, '0')}.jpg`;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img); // Resolve even on error to avoid hanging
        }));
      }
      return Promise.all(promises);
    }

    const loadAllBatched = async () => {
        const batchSize = 50;
        const allImages = new Array(frameCount).fill(null);
        
        // Load first batch immediately for TTI
        const firstBatch = await loadBatch(0, batchSize);
        firstBatch.forEach((img, i) => allImages[i] = img);
        setImages([...allImages]); // Trigger render for first batch
        setImagesLoaded(true);

        // Load rest in background
        for (let i = batchSize; i < frameCount; i += batchSize) {
            const batch = await loadBatch(i, batchSize);
            batch.forEach((img, idx) => allImages[i + idx] = img);
            setImages([...allImages]); // Incremental update
        }
    };
    
    loadAllBatched();
  }, [frameCount, imagePathPrefix]);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Define State Object
    const scrollObj = { frame: 0 };

    // 2. Define Render Function
    const renderFrame = (frameIndex: number) => {
      const idx = Math.round(frameIndex);
      
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (imagePathPrefix && imagesLoaded && images[idx]) {
        // Draw Image - Cover mode
        const img = images[idx];
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      } else {
        // Procedural Fallback: Rotating Wireframe
        renderProcedural(ctx, idx, frameCount, canvas.width, canvas.height);
      }

      // Add "CRT" scanline effect overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillRect(0, i, canvas.width, 1);
      }
    };

    // 3. Define Resize Handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderFrame(scrollObj.frame);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // 4. Setup ScrollTrigger
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5, // Smooth scrubbing
      pin: canvas, // Pin the canvas while scrolling
      onUpdate: (self) => {
        // Map progress (0-1) to frame index
        const targetFrame = Math.round(self.progress * (frameCount - 1));
        gsap.to(scrollObj, {
          frame: targetFrame,
          duration: 0.1, // Quick snap or smooth
          onUpdate: () => renderFrame(scrollObj.frame),
          overwrite: true
        });
      }
    });

    return () => {
      trigger.kill();
      window.removeEventListener('resize', handleResize);
    };
  }, [frameCount, imagesLoaded, images, imagePathPrefix]);

  return (
    <div ref={containerRef} className={`relative w-full ${heightClass} bg-black`}>
      <canvas 
        ref={canvasRef} 
        className="fixed top-0 left-0 w-full h-full object-cover"
      />
      
      {/* Scroll Indicator Overlay */}
       <div className="fixed bottom-10 right-10 mix-blend-difference pointer-events-none z-50 text-yggen-teal font-mono text-xs">
         SCROLL SYSTEM ACTIVE
       </div>
    </div>
  );
};

// Procedural visual for testing without assets
function renderProcedural(ctx: CanvasRenderingContext2D, frame: number, totalFrames: number, width: number, height: number) {
  const progress = frame / totalFrames;
  
  // Center
  const cx = width / 2;
  const cy = height / 2;
  
  // Dynamic color
  ctx.strokeStyle = '#00ADB5'; // Yggen Teal
  ctx.lineWidth = 2;
  
  // Rotating Circle/Geometric shape
  const radius = Math.min(width, height) * 0.2 + (Math.sin(progress * Math.PI * 4) * 50);
  
  ctx.beginPath();
  for (let i = 0; i < 360; i+=10) {
    const angle = (i * Math.PI) / 180 + (progress * Math.PI * 2);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    
    // Connect to center for web effect
    if (i % 30 === 0) {
       ctx.moveTo(cx, cy);
       ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.stroke();
  
  // Text Info
  ctx.font = '20px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`FRAME: ${Math.round(frame)} / ${totalFrames}`, 50, height - 50);
  ctx.fillText(`PROGRESS: ${(progress * 100).toFixed(1)}%`, 50, height - 80);
}

export default ScrollCanvas;
