import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { paymentService, conversationService } from '../services';
import { Spinner, Alert, EmptyState, Modal, formatDateTime } from '../components/ui';

const PAY_METHODS = [
  { key: 'gcash', label: 'GCash', hint: 'Pay with your GCash wallet' },
  { key: 'maya', label: 'Maya', hint: 'Pay with your Maya wallet' },
  { key: 'bank_card', label: 'Bank Card', hint: 'Credit or debit card' }
];

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

function PayModal({ record, onClose, onDone }) {
  const [amount, setAmount] = useState(record.amount != null ? record.amount : '');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await conversationService.pay(record.conversation_id, {
      amount: amount !== '' ? Number(amount) : null,
      reference: reference.trim() || null
    });
    setBusy(false);
    if (res.ok) {
      onDone();
      onClose();
    } else setErr(res.message);
  };

  return (
    <Modal title={`Pay ${record.tutor_name}`} onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        {record.conversation_id ? (
          <>Send payment evidence for your session with <b>{record.tutor_name}</b> — the tutor will confirm it in your conversation.</>
        ) : (
          <>Complete payment for the session with <b>{record.tutor_name}</b>.</>
        )}
      </p>
      {err && <Alert type="error">{err}</Alert>}
      <form className="form" onSubmit={submit}>
        <label>Amount (₱)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          required
        />
        <label>Reference / proof (e.g. GCash ref)</label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Reference or receipt number"
          maxLength={150}
          required
        />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Sending…' : `Pay ₱${amount || 0}`}
        </button>
      </form>
    </Modal>
  );
}

export default function Payment() {
  const payments = useApi(paymentService.mine);
  const [paying, setPaying] = useState(null);
  const [linking, setLinking] = useState(null);
  const [msg, setMsg] = useState(null);

  const onDone = useCallback(() => {
    payments.reload();
    setMsg({ type: 'success', text: 'Payment submitted — the tutor will confirm it in your conversation.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = payments.data?.stats || {};
  const history = payments.data?.history || [];

  return (
    <div>
      <h2>Payment</h2>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {payments.error && <Alert type="error">{payments.error.message}</Alert>}

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
                          <button
                            type="button"
                            className="btn btn-primary btn-sm pay-now-btn"
                            onClick={() => setPaying(p)}
                          >
                            Pay
                          </button>
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
              Link a payment method so you can pay for sessions faster. Linking is coming soon.
            </p>
            <div className="pmethods-grid">
              {PAY_METHODS.map((m) => (
                <div className="pmethod-card" key={m.key}>
                  <b className="pmethod-name">{m.label}</b>
                  <span className="muted small">{m.hint}</span>
                  <button type="button" className="pmethod-link" onClick={() => setLinking(m)}>
                    Link
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {paying && (
        <PayModal record={paying} onClose={() => setPaying(null)} onDone={onDone} />
      )}
      {linking && (
        <Modal title={`Link ${linking.label}`} onClose={() => setLinking(null)}>
          <p>
            <Alert type="error">
              <b>{linking.label}</b> linking is under construction. Please check back soon.
            </Alert>
          </p>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => setLinking(null)}>Got it</button>
          </div>
        </Modal>
      )}
    </div>
  );
}