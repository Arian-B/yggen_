import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollCanvasProps {
  frameCount?: number; // Kept for interface compatibility
  heightClass?: string; // Tailwind height wrapper, e.g., "h-[350vh]"
}

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  label: string;
  hubIndex: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
}

const ScrollCanvas: React.FC<ScrollCanvasProps> = ({ 
  heightClass = "h-[350vh]" 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const particlesRef = useRef<Particle[]>([]);

  // Initialize Plexus Particle System
  useEffect(() => {
    const labels = [
      "Quantum Mechanics", "Astrobiology", "Linguistics", "Neuroscience",
      "Epistemology", "Machine Learning", "Thermodynamics", "Cryptography",
      "Ancient Rome", "Renaissance", "Genetics", "Plate Tectonics",
      "Game Theory", "Cosmology", "Anthropology", "Microbiology",
      "Graph Theory", "Sociobiology", "Cybernetics", "Biomimicry",
      "String Theory", "Dark Matter", "Holography", "Evolutionary Psychology"
    ];

    const particles: Particle[] = [];
    const count = 90;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 80 + Math.random() * 320;
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        baseX: (Math.random() - 0.5) * 800,
        baseY: (Math.random() - 0.5) * 800,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2,
        label: labels[i % labels.length],
        hubIndex: i % 3,
        orbitRadius: radius,
        orbitSpeed: (0.05 + Math.random() * 0.15) * (Math.random() < 0.5 ? 1 : -1),
        orbitAngle: angle
      });
    }

    particlesRef.current = particles;
  }, []);

  // Set up mouse listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (canvas) canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Animation Loop and Scroll Trigger
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // ScrollTrigger to tie scroll status to local progress
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
      pin: canvas,
      onUpdate: (self) => {
        progressRef.current = self.progress;
      }
    });

    // Pleux animation update & render
    const updateAndDraw = () => {
      time++;
      const progress = progressRef.current;
      const width = canvas.width;
      const height = canvas.height;
      const isDark = document.documentElement.classList.contains('dark');

      // Clear Canvas
      ctx.fillStyle = isDark ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw Perspective Digital Grid (Depth layer)
      ctx.strokeStyle = isDark ? 'rgba(0, 173, 181, 0.05)' : 'rgba(0, 173, 181, 0.12)';
      ctx.lineWidth = 1;
      const cx = width / 2;
      const cy = height / 2;
      const horizon = height * 0.38;

      // Vertical perspective lines
      const verticalLines = 36;
      for (let i = 0; i <= verticalLines; i++) {
        const frac = (i / verticalLines) - 0.5;
        const xStart = cx + frac * 20;
        const xEnd = cx + frac * width * 4.5;
        ctx.beginPath();
        ctx.moveTo(xStart, horizon);
        ctx.lineTo(xEnd, height);
        ctx.stroke();
      }

      // Horizontal lines flowing with scroll + time
      const horizontalLines = 14;
      const gridScroll = (progress * 4 + time * 0.004) % 1.0;
      for (let i = 0; i < horizontalLines; i++) {
        const yFrac = Math.pow((i + gridScroll) / horizontalLines, 2.5); // perspective compression
        const y = horizon + yFrac * (height - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Attractor coordinates for stage-3 clusters (Domains Hubs)
      const hubs = [
        { x: width * 0.28, y: height * 0.5, label: "Science" },
        { x: width * 0.72, y: height * 0.5, label: "Humanities" },
        { x: width * 0.5, y: height * 0.25, label: "Technology" }
      ];

      const particles = particlesRef.current;

      // 2. Draw plexus connections first
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;
          const maxDistSq = 130 * 130;

          if (distSq < maxDistSq) {
            const alpha = (1.0 - distSq / maxDistSq) * 0.16;
            ctx.strokeStyle = `rgba(0, 173, 181, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // 3. Update particle coordinates & Draw them
      particles.forEach((p, idx) => {
        // Orbit angle incremental updates
        p.orbitAngle += p.orbitSpeed * 0.008;

        // Position A: Dispersed Nebula
        const nx = cx + p.baseX + Math.sin(time * 0.0003 + idx) * 100;
        const ny = cy + p.baseY + Math.cos(time * 0.0003 + idx) * 100;

        // Position B: Attractor Galaxy
        const gx = cx + Math.cos(p.orbitAngle) * (p.orbitRadius * 1.1);
        const gy = cy + Math.sin(p.orbitAngle) * (p.orbitRadius * 0.65);

        // Position C: Domain Clusters
        const hub = hubs[p.hubIndex];
        const hx = hub.x + Math.cos(p.orbitAngle * 1.5) * (40 + p.orbitRadius * 0.18);
        const hy = hub.y + Math.sin(p.orbitAngle * 1.5) * (40 + p.orbitRadius * 0.12);

        // Position D: Cascading timeline feed (pinned on left)
        const lx = width * 0.15 + Math.sin(idx * 0.3) * 8;
        const ly = height * 0.12 + (idx * (height * 0.72) / particles.length);

        // Morphing path interpolations based on scroll progress
        let tx = nx;
        let ty = ny;

        if (progress < 0.25) {
          const t = progress / 0.25;
          tx = nx + (gx - nx) * t;
          ty = ny + (gy - ny) * t;
        } else if (progress < 0.65) {
          const t = (progress - 0.25) / 0.40;
          tx = gx + (hx - gx) * t;
          ty = gy + (hy - gy) * t;
        } else {
          const t = Math.min((progress - 0.65) / 0.35, 1.0);
          tx = hx + (lx - hx) * t;
          ty = hy + (ly - hy) * t;
        }

        // Apply mouse-repulsion physics
        if (mouseRef.current.active) {
          const mdx = tx - mouseRef.current.x;
          const mdy = ty - mouseRef.current.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < 160) {
            const push = (160 - mDist) / 160; // 0 to 1
            tx += (mdx / mDist) * push * 38;
            ty += (mdy / mDist) * push * 38;
          }
        }

        // Smooth physics ease
        p.x += (tx - p.x) * 0.08;
        p.y += (ty - p.y) * 0.08;

        // Draw particle dot
        ctx.fillStyle = idx % 2 === 0 ? '#00ADB5' : '#005f63';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw text label overlay for nodes
        if (idx % 6 === 0) {
          ctx.font = '8px monospace';
          ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.38)';
          ctx.fillText(p.label, p.x + 8, p.y + 3);
        }
      });

      // 4. Overlap digital artifacts (CRT Scanline and Grid Room stats)
      ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';
      for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 1);
      }

      animationId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationId);
      trigger.kill();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full ${heightClass} bg-white dark:bg-black`}>
      <canvas 
        ref={canvasRef} 
        className="fixed top-0 left-0 w-full h-full object-cover pointer-events-auto"
      />
      
      {/* Scroll indicator stats overlay */}
      <div className="fixed bottom-10 right-10 mix-blend-difference pointer-events-none z-20 text-yggen-teal font-mono text-[10px] tracking-widest uppercase">
        GRID TRAVERSER // SYSTEM ONLINE
      </div>
    </div>
  );
};

export default ScrollCanvas;
