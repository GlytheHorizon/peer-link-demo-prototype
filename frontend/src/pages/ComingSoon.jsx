import React from 'react';
import { EmptyState } from '../components/ui';

export default function ComingSoon({ title }) {
  return (
    <div>
      <h2>{title}</h2>
      <EmptyState
        title="Coming soon"
        description="This section is under construction — check back later."
      />
    </div>
  );
}
