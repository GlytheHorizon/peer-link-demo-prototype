import React, { useState, useEffect, useRef } from 'react';
import { useStripe } from '../context/StripeContext';
import { stripeService } from '../services';
import { Alert } from './ui';

export function StripeCardForm({ onAttached, onError, disabled = false }) {
  const { stripe, stripeReady } = useStripe();
  const containerRef = useRef(null);
  const mountedRef = useRef(false);
  const elementsRef = useRef(null);
  const cardRef = useRef(null);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!stripe || !stripeReady) {
      setMounted(false);
      return undefined;
    }

    let card = null;
    try {
      // No `mode` here: a plain Card Element only needs `createPaymentMethod`,
      // whereas mode:'payment' demands intent params and throws without them.
      const elements = stripe.elements();
      elementsRef.current = elements;
      card = elements.create('card', {
        style: {
          base: {
            fontSize: '15px',
            fontFamily: 'inherit',
            color: '#1f1e33',
            '::placeholder': { color: '#5c5b73' }
          },
          invalid: { color: '#c23c3c' }
        }
      });
      cardRef.current = card;

      if (containerRef.current) {
        card.mount(containerRef.current);
        setMounted(true);
      }
    } catch (err) {
      setLocalError(err && err.message ? err.message : 'Could not initialize the card field');
      setMounted(false);
    }

    return () => {
      mountedRef.current = false;
      try { if (card) card.destroy(); } catch { /* element already gone */ }
      elementsRef.current = null;
      cardRef.current = null;
      setMounted(false);
    };
  }, [stripe, stripeReady]);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !cardRef.current || processing || disabled) return;

    setLocalError(null);
    setProcessing(true);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardRef.current
    });

    setProcessing(false);

    if (error) {
      setLocalError(error.message || 'Could not read card details');
      onError?.(error.message || 'Could not read card details');
      return;
    }

    const res = await stripeService.attachPaymentMethod(paymentMethod.id);
    if (!res.ok) {
      setLocalError(res.message || 'Could not save card');
      onError?.(res.message || 'Could not save card');
      return;
    }

    onAttached?.({
      id: paymentMethod.id,
      brand: res.data?.brand || paymentMethod.card?.brand,
      last4: res.data?.last4 || paymentMethod.card?.last4,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year
    });
  };

  if (!stripeReady) {
    return (
      <div className="stripe-card-saved">
        <p className="muted small">Loading card form…</p>
      </div>
    );
  }

  return (
    <form className="stripe-card-form" onSubmit={submit}>
      <div
        ref={containerRef}
        className="stripe-card-element"
        style={{ minHeight: 44 }}
      />
      {!mounted && stripeReady && (
        <p className="muted small" style={{ margin: 0 }}>
          Preparing card input…
        </p>
      )}
      {localError && <p className="stripe-card-error">{localError}</p>}
      <p className="muted small" style={{ margin: 0 }}>
        Payments are in test mode — no real money is charged.
      </p>
      <button
        className="btn btn-primary"
        type="submit"
        disabled={processing || disabled}
      >
        {processing ? 'Saving…' : 'Add card'}
      </button>
    </form>
  );
}
