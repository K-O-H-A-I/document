import React from "react";
import { motion } from "motion/react";
import { Shield } from "lucide-react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/HeroSection";
import LoginForm from "@/components/LoginForm";

export default function Login() {
  const [, setLocation] = useLocation();

  const handleSuccess = (email: string) => {
    window.localStorage.setItem("tt_user_email", email);
    setLocation("/");
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background:
          "radial-gradient(1200px 520px at 85% -10%, rgba(79,209,197,0.08), transparent 65%), radial-gradient(900px 420px at -10% 110%, rgba(30,58,138,0.06), transparent 60%), linear-gradient(180deg, #f7f8fa 0%, #f0f1f3 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <header className="w-full px-6 sm:px-8 lg:px-12 py-3.5 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}brand-logo.png`}
            alt="Reagvis Labs"
            className="h-7 w-auto object-contain"
          />
          <div className="hidden sm:block w-px h-5 bg-slate-200" />
          <div
            className="hidden sm:flex items-center gap-2 text-slate-400 text-[11px]"
            style={{ letterSpacing: "0.02em" }}
          >
            <Shield size={12} className="text-slate-400" />
            TrustTrace
          </div>
        </div>
        <div />
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(79,209,197,0.15) 20%, rgba(79,209,197,0.3) 50%, rgba(79,209,197,0.15) 80%, transparent 100%)",
          }}
        />
      </header>

      <main className="flex-1 flex items-start lg:items-center justify-center pt-3 pb-4 px-4 lg:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.62,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: 0.08,
          }}
          className="relative w-full max-w-[1120px] bg-white rounded-2xl overflow-hidden border border-slate-200/60 flex flex-col lg:flex-row"
          style={{
            minHeight: "min(640px, 80vh)",
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.03), 0 10px 24px rgba(0,0,0,0.05), 0 28px 52px rgba(0,0,0,0.06)",
          }}
        >
          <div className="hidden lg:block lg:w-[480px] xl:w-[520px] shrink-0 relative z-10 overflow-hidden rounded-l-2xl">
            <HeroSection />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-px z-20">
              <div
                className="w-full h-full"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(79,209,197,0) 0%, rgba(79,209,197,0.25) 30%, rgba(79,209,197,0.4) 50%, rgba(79,209,197,0) 100%)",
                }}
              />
              <div
                className="absolute top-0 bottom-0 -right-[15px] w-[30px]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(79,209,197,0) 0%, rgba(79,209,197,0.1) 50%, rgba(79,209,197,0) 100%)",
                  filter: "blur(8px)",
                }}
              />
            </div>
          </div>

          <div className="lg:hidden h-36 sm:h-40 relative overflow-hidden z-10 rounded-t-2xl">
            <HeroSection />
          </div>

          <div className="flex-1 min-w-0 relative z-0 bg-white">
            <div
              className="hidden lg:block absolute left-0 top-0 bottom-0 w-[200px] pointer-events-none z-0"
              style={{ background: "linear-gradient(90deg, rgba(16,22,32,0.03) 0%, transparent 100%)" }}
            />
            <div className="relative z-10 h-full">
              <LoginForm onSuccess={handleSuccess} />
            </div>
          </div>
        </motion.div>
      </main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="w-full px-6 sm:px-8 lg:px-12 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2 relative"
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 20%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 80%, transparent 100%)",
          }}
        />
        <p className="text-slate-400 text-[11px]">
          {"\u00A9"} 2026 Reagvis Labs
        </p>
        <p
          className="text-slate-300 text-[10px]"
          style={{ fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em" }}
        >
          GUARDIANS OF AUTHENTICITY
        </p>
      </motion.footer>
    </div>
  );
}
