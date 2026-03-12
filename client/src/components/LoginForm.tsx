import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

type LoginFormProps = {
  onSuccess?: (email: string) => void;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.16 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, x: -6 },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(normalizeEmail(value));

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const passwordValue = password.trim();
  const canSubmit = isValidEmail(email) && passwordValue.length > 0 && !isLoading && !isSuccess;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading || isSuccess) return;

    const nextEmail = normalizeEmail(email);
    const nextPassword = password.trim();
    let valid = true;

    if (!nextEmail) {
      setEmailError("Email is required");
      valid = false;
    } else if (!isValidEmail(nextEmail)) {
      setEmailError("Please enter a valid email");
      valid = false;
    } else {
      setEmailError("");
    }

    if (!nextPassword) {
      setPasswordError("Password is required");
      valid = false;
    } else {
      setPasswordError("");
    }

    setEmail(nextEmail);

    if (valid) {
      setIsLoading(true);
      setIsSuccess(false);
      setCapsLockOn(false);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true);
        setPassword("");
        setShowPassword(false);
        timeoutRef.current = window.setTimeout(() => {
          setIsSuccess(false);
          onSuccess?.(nextEmail);
        }, 450);
      }, 1800);
    }
  };

  const handlePasswordKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState("CapsLock"));
  };

  const handlePasswordFocus = () => {
    setPasswordFocused(true);
    setCapsLockOn(false);
  };

  const handlePasswordBlur = () => {
    setPasswordFocused(false);
    setCapsLockOn(false);
  };

  return (
    <div className="flex flex-col justify-center h-full px-7 py-9 lg:px-16 xl:px-20" style={{ fontFamily: "Inter, sans-serif" }}>
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="max-w-[400px]">
        <motion.div variants={itemVariants} className="mb-7">
          <p
            className="font-medium uppercase tracking-[0.15em] mb-2 text-[11px]"
            style={{ color: "#4fd1c5", fontFamily: "JetBrains Mono, monospace" }}
          >
            Secure Access
          </p>
          <h1 className="text-slate-900 font-semibold tracking-tight text-[30px] leading-[1.2]">Login</h1>
          <p className="text-slate-500 mt-2 text-[14px] leading-[1.5]">
            Enter your credentials to access TrustTrace.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="relative rounded-2xl p-6 xl:p-7 border border-slate-200/80 bg-white/80 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.9) inset, 0 8px 28px rgba(0,0,0,0.045), 0 2px 8px rgba(0,0,0,0.03)",
          }}
        >
          <div className="absolute top-0 left-6 right-6 xl:left-8 xl:right-8 h-[2px] rounded-full overflow-hidden">
            <div
              className="w-full h-full"
              style={{
                background: "linear-gradient(90deg, transparent, #4fd1c5, transparent)",
                backgroundSize: "200% 100%",
                animation: "borderFlow 5.5s ease-in-out infinite",
              }}
            />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-[18px]">
            <div className="space-y-1.5">
              <label className="text-slate-600 font-medium flex items-center gap-2 text-[12px] tracking-[0.01em]">
                <Mail size={12} className="text-slate-400" />
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text");
                    if (pasted) {
                      event.preventDefault();
                      const cleaned = normalizeEmail(pasted);
                      setEmail(cleaned);
                      if (emailError) setEmailError("");
                    }
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => {
                    setEmailFocused(false);
                    setEmail((current) => normalizeEmail(current));
                  }}
                  autoComplete="username"
                  spellCheck={false}
                  className={[
                    "w-full px-4 py-[11px] rounded-xl bg-slate-50/80 text-[14px] text-slate-700 placeholder:text-slate-300 border transition-[border-color,box-shadow,background-color] duration-300 outline-none focus-visible:outline-none",
                    emailError
                      ? "border-red-300 ring-[2px] ring-red-400/10"
                      : "border-slate-200/90 hover:border-slate-300 focus:border-[#4fd1c5]/40 focus:ring-[1px] focus:ring-[#4fd1c5]/25 focus:bg-white focus:shadow-[0_6px_14px_rgba(15,118,110,0.06)]",
                  ].join(" ")}
                />
                <motion.div
                  className="absolute left-4 right-4 bottom-0 h-[1px] rounded-full bg-[#4fd1c5]"
                  initial={false}
                  animate={{ scaleX: emailFocused ? 1 : 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  style={{ transformOrigin: "50% 50%" }}
                />
              </div>
              {emailError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-[11px] font-medium"
                >
                  {emailError}
                </motion.p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-600 font-medium flex items-center gap-2 text-[12px] tracking-[0.01em]">
                  <Lock size={12} className="text-slate-400" />
                  Password
                </label>
                <button
                  type="button"
                  className="text-[#4fd1c5] hover:text-[#38b2ac] font-medium hover:underline text-[11px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4fd1c5]/60 focus-visible:outline-offset-2 rounded"
                  title="Password recovery will be enabled when backend auth is connected."
                  aria-label="Password recovery will be enabled when backend auth is connected."
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  onKeyUp={handlePasswordKey}
                  onKeyDown={handlePasswordKey}
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  autoComplete="current-password"
                  className={[
                    "w-full px-4 py-[11px] pr-11 rounded-xl bg-slate-50/80 text-[14px] text-slate-700 placeholder:text-slate-300 border transition-[border-color,box-shadow,background-color] duration-300 outline-none focus-visible:outline-none",
                    passwordError
                      ? "border-red-300 ring-[2px] ring-red-400/10"
                      : "border-slate-200/90 hover:border-slate-300 focus:border-[#4fd1c5]/40 focus:ring-[1px] focus:ring-[#4fd1c5]/25 focus:bg-white focus:shadow-[0_6px_14px_rgba(15,118,110,0.06)]",
                  ].join(" ")}
                />
                <motion.div
                  className="absolute left-4 right-4 bottom-0 h-[1px] rounded-full bg-[#4fd1c5]"
                  initial={false}
                  animate={{ scaleX: passwordFocused ? 1 : 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  style={{ transformOrigin: "50% 50%" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer w-4 h-4 rounded-md min-h-[32px] min-w-[32px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4fd1c5]/60 focus-visible:outline-offset-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {showPassword ? (
                      <motion.span
                        key="eyeoff"
                        initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                        className="block"
                      >
                        <EyeOff size={16} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="eye"
                        initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                        className="block"
                      >
                        <Eye size={16} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
              {capsLockOn && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[11px] text-amber-600 font-medium"
                >
                  Caps Lock is on
                </motion.p>
              )}
              {passwordError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-[11px] font-medium"
                >
                  {passwordError}
                </motion.p>
              )}

            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              disabled={!canSubmit}
              className="group relative w-full min-h-[44px] py-3 rounded-xl text-white font-medium text-[14px] tracking-[0.01em] overflow-hidden disabled:opacity-100 disabled:cursor-not-allowed active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4fd1c5]/70 focus-visible:outline-offset-2"
              style={{
                background: "linear-gradient(135deg, #2d8a80 0%, #38b2ac 52%, #4fd1c5 100%)",
                boxShadow: isSuccess
                  ? "0 4px 15px rgba(45,138,128,0.35), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.18)"
                  : "0 4px 15px rgba(45,138,128,0.25), 0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)",
                  animation: "shimmer 2s linear infinite",
                }}
              />
              <span className="relative flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : isSuccess ? (
                  <>
                    <ShieldCheck size={18} />
                    Access granted
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </motion.button>
          </form>
        </motion.div>

        <motion.p variants={itemVariants} className="text-slate-400 mt-5 text-[11px]">
          Protected by Reagvis Labs security controls.
        </motion.p>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes borderFlow {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 100% 0%; }
        }
      `}</style>
    </div>
  );
}
