import React, { useEffect, useMemo, useState } from 'react';
import { User, X, CreditCard } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const getDisplayName = () => {
  const raw = window.localStorage.getItem('tt_display_email')?.trim() || '';
  if (!raw.includes('@')) return 'User';

  const prefix = raw.split('@')[0]?.trim() || '';
  return prefix || 'User';
};

export function NavBar() {
  const [billingOpen, setBillingOpen] = useState(false);
  const [userLabel, setUserLabel] = useState('User');

  useEffect(() => {
    const syncUserLabel = () => {
      setUserLabel(getDisplayName());
    };

    syncUserLabel();
    window.addEventListener('tt:user-updated', syncUserLabel);

    return () => {
      window.removeEventListener('tt:user-updated', syncUserLabel);
    };
  }, []);

  const truncatedUserLabel = useMemo(() => {
    return userLabel.length > 12 ? `${userLabel.slice(0, 12)}…` : userLabel;
  }, [userLabel]);

  return (
    <>
      <nav className="h-16 border-b border-border bg-panel sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src={`${import.meta.env.BASE_URL}brand-logo.png`} 
              alt="Reagvis Labs Pvt. Ltd." 
              className="h-[34px] md:h-[40px] max-w-[280px] object-contain block" 
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setBillingOpen(true)}
              className="flex items-center gap-3 pl-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 rounded-[var(--radius)]"
              aria-label="Open billing"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-[var(--text)] truncate max-w-[160px]" title={userLabel}>
                  {truncatedUserLabel}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[var(--panel2)] border border-[var(--border)] flex items-center justify-center">
                <User className="w-5 h-5 text-[var(--muted)]" />
              </div>
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {billingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/30 backdrop-blur-sm"
            onClick={() => setBillingOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-6 top-20 w-[360px] max-w-[90vw] bg-[var(--panel)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-strong)] p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[var(--panel2)] border border-[var(--border)] flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">Billing</p>
                    <p className="text-xs text-[var(--muted)]">Demo overview</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBillingOpen(false)}
                  className="btn btn-ghost p-2 rounded-full hover:bg-[var(--panel2)]"
                  aria-label="Close billing"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Today's balance</span>
                  <span className="font-semibold text-[var(--text)]">{"\u20B9"}500</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">Spent today</span>
                  <span className="font-semibold text-[var(--text)]">{"\u20B9"}400</span>
                </div>
              </div>

              <div className="mt-4 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
                Usage is summarized for demo purposes only.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
