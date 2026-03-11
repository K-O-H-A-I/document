import { useCallback, useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  pulse: number;
};

type BurstParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
};

export function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0.5, y: 0.5, active: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<BurstParticle[]>([]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      active: true,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.45;
    const dist = Math.hypot(clickX - cx, clickY - cy);
    if (dist >= 120) return;

    const next: BurstParticle[] = [];
    const count = 24;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.3;
      const speed = 1.5 + Math.random() * 3;
      next.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 40 + Math.random() * 30,
        r: 1.5 + Math.random() * 2,
      });
    }
    burstRef.current = burstRef.current.concat(next);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let scanY = 0;
    let smoothMX = 0.5;
    let smoothMY = 0.5;

    const drawHexagon = (
      cx: number,
      cy: number,
      r: number,
      alpha: number,
      color: string,
      lw = 1.5
    ) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const initParticles = () => {
      particles = [];
      const count = Math.floor((w * h) / 4000);
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.3 + 0.05,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const draw = (time: number) => {
      const t = time * 0.001;
      if (w === 0 || h === 0) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const mouse = mouseRef.current;
      const targetMX = mouse.active ? mouse.x : 0.5;
      const targetMY = mouse.active ? mouse.y : 0.5;
      smoothMX += (targetMX - smoothMX) * 0.04;
      smoothMY += (targetMY - smoothMY) * 0.04;
      const px = (smoothMX - 0.5) * 2;
      const py = (smoothMY - 0.5) * 2;
      const gridOffX = px * 8;
      const gridOffY = py * 8;
      const partOffX = px * 12;
      const partOffY = py * 12;
      const hexOffX = px * 6;
      const hexOffY = py * 6;
      const shieldOffX = px * 3;
      const shieldOffY = py * 3;

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#161e2a");
      bg.addColorStop(0.5, "#101620");
      bg.addColorStop(1, "#0a0e14");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.015)";
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = -gridSize + (gridOffX % gridSize); x < w + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = -gridSize + (gridOffY % gridSize); y < h + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      scanY = (scanY + 0.4) % h;
      const scan = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      scan.addColorStop(0, "rgba(79, 209, 197, 0)");
      scan.addColorStop(0.5, "rgba(79, 209, 197, 0.04)");
      scan.addColorStop(1, "rgba(79, 209, 197, 0)");
      ctx.fillStyle = scan;
      ctx.fillRect(0, scanY - 40, w, 80);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.02;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        const pulseAlpha = Math.max(0, p.alpha + Math.sin(p.pulse) * 0.1);
        const drawX = p.x + partOffX;
        const drawY = p.y + partOffY;
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79, 209, 197, ${pulseAlpha})`;
        ctx.fill();
      }

      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 80) {
            const a = (1 - dist / 80) * 0.08;
            ctx.strokeStyle = `rgba(79, 209, 197, ${a})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x + partOffX, particles[i].y + partOffY);
            ctx.lineTo(particles[j].x + partOffX, particles[j].y + partOffY);
            ctx.stroke();
          }
        }
      }

      const cx = w * 0.5 + shieldOffX;
      const cy = h * 0.45 + shieldOffY;

      const scatterHexes = [
        { x: 0.15, y: 0.2, r: 25, a: 0.06, speed: 0.3 },
        { x: 0.8, y: 0.15, r: 20, a: 0.05, speed: 0.5 },
        { x: 0.25, y: 0.7, r: 30, a: 0.06, speed: 0.4 },
        { x: 0.75, y: 0.65, r: 22, a: 0.07, speed: 0.35 },
        { x: 0.1, y: 0.5, r: 18, a: 0.04, speed: 0.6 },
        { x: 0.85, y: 0.4, r: 28, a: 0.05, speed: 0.25 },
        { x: 0.6, y: 0.82, r: 15, a: 0.05, speed: 0.45 },
        { x: 0.35, y: 0.35, r: 35, a: 0.04, speed: 0.55 },
      ];
      for (const hex of scatterHexes) {
        const drift = Math.sin(t * hex.speed) * 3;
        drawHexagon(hex.x * w + drift + hexOffX, hex.y * h + drift * 0.5 + hexOffY, hex.r, hex.a, "#4fd1c5");
      }

      const breathe = Math.sin(t * 0.8) * 0.05;
      drawHexagon(cx, cy, 120 + Math.sin(t * 0.5) * 4, 0.1 + breathe, "#4fd1c5");
      drawHexagon(cx, cy, 90 + Math.sin(t * 0.7) * 3, 0.15 + breathe, "#4fd1c5");
      drawHexagon(cx, cy, 60 + Math.sin(t * 0.9) * 2, 0.2 + breathe, "#4fd1c5");
      drawHexagon(cx, cy, 30 + Math.sin(t * 1.1) * 1, 0.25 + breathe, "#4fd1c5");

      const s = Math.max(Math.min(w, h) / 600, 0.55);
      for (let ring = 1; ring <= 3; ring += 1) {
        const radius = 70 * s + ring * 18 * s + Math.sin(t * 1.2 + ring) * 3;
        const a = 0.03 + ring * 0.012 + Math.sin(t + ring) * 0.005;
        ctx.strokeStyle = `rgba(79, 209, 197, ${a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100 * s);
      bloom.addColorStop(0, `rgba(79, 209, 197, ${0.12 + Math.sin(t * 0.6) * 0.03})`);
      bloom.addColorStop(0.5, "rgba(79, 209, 197, 0.04)");
      bloom.addColorStop(1, "rgba(79, 209, 197, 0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(cx - 100 * s, cy - 100 * s, 200 * s, 200 * s);

      const shieldW = 38 * s;
      const shieldTopH = 24 * s;
      const shieldBotH = 42 * s;
      const shieldPath = new Path2D();
      shieldPath.moveTo(cx, cy - shieldTopH - 10 * s);
      shieldPath.lineTo(cx + shieldW, cy - shieldTopH + 8 * s);
      shieldPath.lineTo(cx + shieldW, cy + 4 * s);
      shieldPath.quadraticCurveTo(cx + shieldW * 0.6, cy + shieldBotH * 0.75, cx, cy + shieldBotH);
      shieldPath.quadraticCurveTo(cx - shieldW * 0.6, cy + shieldBotH * 0.75, cx - shieldW, cy + 4 * s);
      shieldPath.lineTo(cx - shieldW, cy - shieldTopH + 8 * s);
      shieldPath.closePath();

      ctx.save();
      ctx.shadowColor = "#4fd1c5";
      ctx.shadowBlur = 30 * s + Math.sin(t) * 8;
      ctx.fillStyle = "rgba(79, 209, 197, 0.08)";
      ctx.fill(shieldPath);
      ctx.restore();

      const shieldFill = ctx.createLinearGradient(cx - shieldW, cy - shieldTopH, cx + shieldW, cy + shieldBotH);
      shieldFill.addColorStop(0, "rgba(79, 209, 197, 0.22)");
      shieldFill.addColorStop(0.35, "rgba(79, 209, 197, 0.12)");
      shieldFill.addColorStop(0.65, "rgba(30, 80, 100, 0.1)");
      shieldFill.addColorStop(1, "rgba(79, 209, 197, 0.05)");
      ctx.fillStyle = shieldFill;
      ctx.fill(shieldPath);

      const highlight = new Path2D();
      highlight.moveTo(cx, cy - shieldTopH - 8 * s);
      highlight.lineTo(cx + shieldW * 0.85, cy - shieldTopH + 10 * s);
      highlight.lineTo(cx + shieldW * 0.5, cy - shieldTopH + 16 * s);
      highlight.lineTo(cx - shieldW * 0.5, cy - shieldTopH + 16 * s);
      highlight.lineTo(cx - shieldW * 0.85, cy - shieldTopH + 10 * s);
      highlight.closePath();
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.fill(highlight);

      const borderGrad = ctx.createLinearGradient(cx, cy - shieldTopH - 10 * s, cx, cy + shieldBotH);
      borderGrad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
      borderGrad.addColorStop(0.3, "rgba(79, 209, 197, 0.6)");
      borderGrad.addColorStop(0.7, "rgba(79, 209, 197, 0.3)");
      borderGrad.addColorStop(1, "rgba(79, 209, 197, 0.1)");
      ctx.strokeStyle = borderGrad;
      ctx.lineWidth = 1.8 * s;
      ctx.stroke(shieldPath);

      const orbitRadius = 62 * s;
      const dotPositions: { x: number; y: number }[] = [];
      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 / 8) * i - Math.PI / 2 + t * 0.15;
        const ox = cx + orbitRadius * Math.cos(angle);
        const oy = cy + orbitRadius * Math.sin(angle);
        dotPositions.push({ x: ox, y: oy });
        const dotAlpha = 0.25 + Math.sin(t * 2 + i) * 0.1;
        ctx.beginPath();
        ctx.arc(ox, oy, 2.2 * s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79, 209, 197, ${dotAlpha})`;
        ctx.fill();

        const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, 6 * s);
        halo.addColorStop(0, `rgba(79, 209, 197, ${dotAlpha * 0.4})`);
        halo.addColorStop(1, "rgba(79, 209, 197, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(ox, oy, 6 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      dotPositions.forEach((pos, idx) => {
        if (idx === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      });
      ctx.closePath();
      ctx.strokeStyle = "rgba(79, 209, 197, 0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const bursts = burstRef.current;
      for (let i = bursts.length - 1; i >= 0; i -= 1) {
        const bp = bursts[i];
        bp.x += bp.vx;
        bp.y += bp.vy;
        bp.vx *= 0.97;
        bp.vy *= 0.97;
        bp.life -= 1 / bp.maxLife;

        if (bp.life <= 0) {
          bursts.splice(i, 1);
          continue;
        }

        const ba = bp.life * 0.6;
        const bx = bp.x + shieldOffX;
        const by = bp.y + shieldOffY;

        ctx.beginPath();
        ctx.arc(bx, by, bp.r * bp.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(79, 209, 197, ${ba})`;
        ctx.fill();

        const bGlow = ctx.createRadialGradient(bx, by, 0, bx, by, bp.r * bp.life * 3);
        bGlow.addColorStop(0, `rgba(79, 209, 197, ${ba * 0.3})`);
        bGlow.addColorStop(1, "rgba(79, 209, 197, 0)");
        ctx.fillStyle = bGlow;
        ctx.beginPath();
        ctx.arc(bx, by, bp.r * bp.life * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 0.025;
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px 'JetBrains Mono', monospace";
      const words = [
        "VERIFIED",
        "INTEGRITY",
        "SCAN",
        "SECURE",
        "TRUST",
        "AUTHENTIC",
        "TRACE",
        "VALID",
        "ENCRYPT",
        "SHIELD",
      ];
      for (let i = 0; i < 35; i += 1) {
        const x = (Math.sin(i * 7.3) * 0.5 + 0.5) * w;
        const y = (Math.cos(i * 5.1) * 0.5 + 0.5) * h;
        ctx.fillText(words[i % words.length], x, y);
      }
      ctx.globalAlpha = 1;

      const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
      centerGlow.addColorStop(0, `rgba(79, 209, 197, ${0.06 + Math.sin(t * 0.5) * 0.02})`);
      centerGlow.addColorStop(1, "rgba(79, 209, 197, 0)");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, w, h);

      const pinkGlow = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, 200);
      pinkGlow.addColorStop(0, "rgba(236, 116, 149, 0.04)");
      pinkGlow.addColorStop(1, "rgba(236, 116, 149, 0)");
      ctx.fillStyle = pinkGlow;
      ctx.fillRect(0, 0, w, h);

      const orangeGlow = ctx.createRadialGradient(w * 0.1, h * 0.9, 0, w * 0.1, h * 0.9, 200);
      orangeGlow.addColorStop(0, "rgba(251, 168, 93, 0.03)");
      orangeGlow.addColorStop(1, "rgba(251, 168, 93, 0)");
      ctx.fillStyle = orangeGlow;
      ctx.fillRect(0, 0, w, h);

      const vignette = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.85
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    };

    let orientHandler: ((e: DeviceOrientationEvent) => void) | null = null;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (isMobile && "DeviceOrientationEvent" in window) {
      orientHandler = (e: DeviceOrientationEvent) => {
        const gamma = (e.gamma || 0) / 45;
        const beta = ((e.beta || 0) - 45) / 45;
        mouseRef.current = {
          x: 0.5 + gamma * 0.3,
          y: 0.5 + beta * 0.3,
          active: true,
        };
      };
      window.addEventListener("deviceorientation", orientHandler);
    }

    resize();
    animRef.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (orientHandler) {
        window.removeEventListener("deviceorientation", orientHandler);
      }
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative w-full h-full overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-12">
        <div />
        <div className="space-y-3.5">
          <h1
            className="text-transparent bg-clip-text font-semibold"
            style={{
              fontSize: "clamp(42px, 6vw, 50px)",
              lineHeight: 0.94,
              letterSpacing: "-0.045em",
              backgroundImage:
                "linear-gradient(135deg, #ffffff 0%, #ffffff 52%, rgba(79,209,197,0.72) 100%)",
              WebkitBackgroundClip: "text",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Trust
            <br />
            Trace
          </h1>
          <div className="w-12 h-[2px] bg-gradient-to-r from-[#4fd1c5] to-transparent rounded-full" />
          <p
            className="text-white/35 max-w-[270px]"
            style={{ fontSize: "13px", lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}
          >
            Enterprise-grade document verification and authenticity analysis platform.
          </p>
        </div>
      </div>
    </div>
  );
}
