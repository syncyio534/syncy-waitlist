import React, { useEffect, useMemo, useState } from 'react';

export default function App() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(null);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    let active = true;

    fetch('/api/waitlist')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (typeof data.waitlistCount === 'number') {
          setCount(data.waitlistCount);
        }
      })
      .catch(() => {
        // Keep UI usable even if count endpoint fails.
      });

    return () => {
      active = false;
    };
  }, []);

  async function submitWaitlist(event) {
    event.preventDefault();

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          consent,
          website,
          startedAt,
          turnstileToken: ''
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Unable to join waitlist right now.');
        return;
      }

      setStatus('success');
      setMessage('You are on the list. We will reach out before launch.');
      setEmail('');
      setPhone('');
      setConsent(false);
      if (typeof data.waitlistCount === 'number') {
        setCount(data.waitlistCount);
      } else if (typeof count === 'number') {
        setCount(count + 1);
      }
    } catch (_err) {
      setStatus('error');
      setMessage('Network error. Please try again in a moment.');
    }
  }

  return (
    <main className="syncy-waitlist-page">
      <section className="syncy-waitlist-card" aria-live="polite">
        <div className="syncy-logo" aria-hidden="true">
          <span className="syncy-dot syncy-dot-a" />
          <span className="syncy-dot syncy-dot-b" />
        </div>

        <h1>SYNCY</h1>
        <p className="syncy-tagline">Share music, share moments</p>

        <div className="syncy-meter" role="status" aria-label="Current waitlist count">
          <p>
            {typeof count === 'number' ? (
              <>
                <strong>{count.toLocaleString()}</strong> people currently on the waitlist
              </>
            ) : (
              'Live waitlist count unavailable right now'
            )}
          </p>
        </div>

        <form onSubmit={submitWaitlist} className="syncy-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <input
            className="syncy-hp"
            tabIndex={-1}
            autoComplete="off"
            type="text"
            name="website"
            aria-hidden="true"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />

          <label className="syncy-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            <span>I agree to receive updates about SYNCY&apos;s launch and features</span>
          </label>

          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Joining...' : 'Join the Waitlist'}
          </button>

          {message ? <p className={`syncy-feedback ${status}`}>{message}</p> : null}
        </form>

        <p className="syncy-privacy">We respect your privacy. Unsubscribe at any time.</p>
      </section>
    </main>
  );
}
