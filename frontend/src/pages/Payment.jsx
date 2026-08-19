import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { paymentService } from '../services';
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

export default function Payment() {
  const payments = useApi(paymentService.mine);
  const [linking, setLinking] = useState(null);
  const [msg, setMsg] = useState(null);

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