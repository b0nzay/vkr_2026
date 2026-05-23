import React from 'react';
import { Outlet } from 'react-router-dom';

export default function StorefrontLayout() {
  return (
    <div className="sf-shell">
      <main className="sf-main">
        <Outlet />
      </main>
    </div>
  );
}
