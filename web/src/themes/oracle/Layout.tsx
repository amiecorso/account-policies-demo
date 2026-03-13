'use client';

import React from 'react';
import './theme.css';

type Page = 'morpho' | 'moirai';

interface OracleLayoutProps {
  children: React.ReactNode;
  activePage: Page;
}

export function OracleLayout({ children, activePage }: OracleLayoutProps) {
  return (
    <div className="theme-oracle oracle-starfield" style={{ minHeight: '100vh' }}>
      <Header activePage={activePage} />
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
}

function Header({ activePage }: { activePage: Page }) {
  return (
    <header
      style={{
        borderBottom: '1px solid #2a2a6b',
        background: 'rgba(13,13,34,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Logo mark — three fates threads */}
        <div className="oracle-threads" style={{ marginRight: 16 }}>
          <div className="oracle-thread oracle-thread-1" />
          <div className="oracle-thread oracle-thread-2" />
          <div className="oracle-thread oracle-thread-3" />
        </div>

        {/* Brand name */}
        <span
          className="oracle-heading-gold"
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            marginRight: 24,
            letterSpacing: '0.14em',
          }}
        >
          Account Policies
        </span>

        {/* Divider */}
        <span
          style={{
            color: '#2a2a6b',
            marginRight: 20,
            fontSize: '1rem',
            userSelect: 'none',
          }}
        >
          ◆
        </span>

        {/* Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center' }}>
          <a
            href="/"
            className={`oracle-nav-link${activePage === 'morpho' ? ' active' : ''}`}
          >
            Morpho Lend
          </a>
          <a
            href="/moirai-delegate"
            className={`oracle-nav-link${activePage === 'moirai' ? ' active' : ''}`}
            style={{ marginLeft: 4 }}
          >
            Moirai Delegate
          </a>
        </nav>
      </div>
    </header>
  );
}
