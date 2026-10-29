import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const StripeContext = createContext(null);

/**
 * Lightweight Stripe loader.
 *
 * In this app the publishable key is served from /api/stripe/config so the
 * frontend never hardcodes it. Until that endpoint responds we show nothing
 * and keep stripe in a "loading" state. In sandbox mode this is the same key
 * pattern as production, just the test pk_test_ value.
 */
export function StripeProvider({ children }) {
  const [stripe, setStripe] = useState(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeError, setStripeError] = useState(null);

  const init = useCallback(async () => {
    try {
      // Try the backend config endpoint first (serves publishable key + test
      // mode flag). Fall back to the env build variable if the endpoint is
      // unavailable (e.g. during local dev without the backend).
      let publishableKey = window.STRIPE_PUBLISHABLE_KEY || null;
      try {
        const res = await fetch('/api/stripe/config');
        if (res.ok) {
          const payload = await res.json();
          // API shape: { success, data: { publishable_key, ... } }
          const data = payload.data || payload;
          publishableKey = data.publishable_key || publishableKey;
        }
      } catch {
        // ignore — fallback to window/env value below
      }

      if (!publishableKey) {
        setStripeError(new Error('Stripe publishable key is not configured'));
        return;
      }

      const stripeObj = await loadStripe(publishableKey);
      if (!stripeObj) {
        setStripeError(new Error('Stripe failed to initialize'));
        return;
      }
      setStripe(stripeObj);
      setStripeReady(true);
    } catch (err) {
      setStripeError(err);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <StripeContext.Provider value={{ stripe, stripeReady, stripeError, reload: init }}>
      {children}
    </StripeContext.Provider>
  );
}

export function useStripe() {
  const ctx = useContext(StripeContext);
  if (!ctx) throw new Error('useStripe must be used inside <StripeProvider>');
  return ctx;
}
