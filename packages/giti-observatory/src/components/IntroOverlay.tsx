'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function IntroOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('observatory-intro-dismissed');
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem('observatory-intro-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-terrarium-surface/80 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-md p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h1 className="font-display text-3xl text-terrarium-text mb-4">
              You're watching a living codebase.
            </h1>
            <p className="text-terrarium-text/70 mb-6 leading-relaxed">
              This creature represents a software project that maintains and
              evolves itself. Everything you see — its mood, its environment,
              its history — is driven by real data.
            </p>
            <button
              onClick={dismiss}
              className="px-6 py-2 rounded-organic bg-terrarium-moss/20 text-terrarium-moss-light border border-terrarium-moss/30 hover:bg-terrarium-moss/30 transition-colors font-display text-sm"
            >
              Enter the terrarium
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
