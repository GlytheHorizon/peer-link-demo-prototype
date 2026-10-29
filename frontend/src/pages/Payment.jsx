import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { paymentService, stripeService } from '../services';
import { useStripe } from '../context/StripeContext';
import { Spinner, Alert, EmptyState, Modal, formatDateTime } from '../components/ui';
import { StripeCardForm } from '../components/StripeCardForm';

const STATUS_LABELS = {
  paid: 'Paid',
  refunded: 'Refunded',
  pending: 'Pending',
  accepted: 'Paid',
  rejected: 'Rejected'
};

function statusClass(status) {
  if (status === 'pending') return 'st-pending';
  if (status === 'rejected' || status === 'refunded') return 'st-rejected';
  return 'st-paid';
}

export default function Payment() {
  const payments = useApi(paymentService.mine, [], 15000);
  const { stripe, stripeReady } = useStripe();
  const saved = useApi(stripeService.saved, [], 0);
  const [linking, setLinking] = useState(null);
  const [newMethod, setNewMethod] = useState(null);
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState(null);

  const stats = payments.data?.stats || {};
  const history = payments.data?.history || [];

  return (
    <div>
      <h2>Payment</h2>

      {msg && <Alert type={msgType || 'info'}>{msg}</Alert>}
      {payments.error && <Alert type="error">{payments.error.message}</Alert>}
      {saved.error && <Alert type="error">{saved.error.message}</Alert>}

      {payments.loading ? (
        <Spinner />
      ) : (
        <>
          <div className="stat-cards payment-stats">
            <div className="stat-card">
              <b className="pay-stat-value is-green">₱{Math.round(Number(stats.total_spent) || 0)}</b>
              <span>Total Spent</span>
            </div>
            <div className="stat-card">
              <b className="pay-stat-value is-orange">₱{Math.round(Number(stats.pending_total) || 0)}</b>
              <span>Pending Payments</span>
            </div>
            <div className="stat-card">
              <b className="pay-stat-value is-green">{Number(stats.completed_count) || 0}</b>
              <span>Completed Payments</span>
            </div>
          </div>

          <section className="card">
            <h3>Payments History</h3>
            {history.length === 0 ? (
              <EmptyState
                title="No payments yet"
                description="Payments you make for sessions and conversation clearance appear here."
              />
            ) : (
              <table className="table payment-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tutor</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={`${p.kind}-${p.id}`}>
                      <td>{formatDateTime(p.date)}</td>
                      <td className="pay-tutor-cell">{p.tutor_name}</td>
                      <td className="pay-amount-cell">₱{Number(p.amount) || 0}</td>
                      <td>
                        <span className={`st ${statusClass(p.status)}`}>
                          {STATUS_LABELS[p.status] || p.status}
                        </span>
                        {p.status === 'pending' && (
                          <span className="muted small">Waiting for tutor confirmation</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <h3>Payment Method</h3>
            <p className="muted small">
              Stripe card is the only payment method in this app right now. Add a card once and use it for every session.
            </p>

            {!stripeReady && !saved.loading && (
              <div className="stripe-card-saved">
                <p className="muted small">Loading Stripe…</p>
              </div>
            )}

            {stripeReady && saved.data && saved.data.length === 0 && (
              <StripeCardForm
                onAttached={(pm) => {
                  setMsg('Card added — you can now pay with it for sessions.');
                  setMsgType('success');
                  saved.reload();
                }}
                onError={(m) => {
                  setMsg(m);
                  setMsgType('error');
                }}
              />
            )}

            {saved.data && saved.data.length > 0 && (
              <div className="stripe-card-saved">
                {saved.data.map((pm) => (
                  <div className={`stripe-saved-method ${pm.is_default ? 'is-default' : ''}`} key={pm.id}>
                    <div>
                      <span className="stripe-saved-brand">{pm.brand || 'Card'}</span>
                      <span className="stripe-saved-detail">
                        ending in {pm.last4} · {pm.exp_month || '?'}/{pm.exp_year || '?'}
                        {pm.is_default ? ' · default' : ''}
                      </span>
                    </div>
                    <div className="stripe-saved-actions">
                      {pm.is_default && <span className="stripe-saved-default">Default</span>}
                      {!pm.is_default && (
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => setNewMethod(pm)}
                        >
                          Set as default
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => setLinking(pm)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <StripeCardForm
                  onAttached={(pm) => {
                    setMsg('Card added — you can now pay with it for sessions.');
                    setMsgType('success');
                    saved.reload();
                  }}
                  onError={(m) => {
                    setMsg(m);
                    setMsgType('error');
                  }}
                />
              </div>
            )}
          </section>
        </>
      )}

      {linking && (
        <Modal title="Remove card?" onClose={() => setLinking(null)}>
          <p>
            Remove this card? You will need to add it again before paying for a session.
          </p>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button
              className="btn btn-danger"
              type="button"
              onClick={async () => {
                const res = await stripeService.removePaymentMethod(linking.id);
                if (res.ok) { setMsg('Card removed.'); setMsgType('success'); saved.reload(); }
                else { setMsg(res.message); setMsgType('error'); }
                setLinking(null);
              }}
            >
              Remove card
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setLinking(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {newMethod && (
        <Modal title="Set as default?" onClose={() => setNewMethod(null)}>
          <p>Make this card the default for future session payments?</p>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={async () => {
                const res = await stripeService.setDefaultPaymentMethod(newMethod.id);
                if (res.ok) { setMsg('Default card updated.'); setMsgType('success'); saved.reload(); }
                else { setMsg(res.message); setMsgType('error'); }
                setNewMethod(null);
              }}
            >
              Save
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setNewMethod(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}