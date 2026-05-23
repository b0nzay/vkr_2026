import React, { useCallback } from 'react';

export default function ScrollToTopButton() {
  const onClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button type="button" className="scroll-to-top" onClick={onClick} aria-label="Наверх">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M12 18V6M12 6l-6 6M12 6l6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
