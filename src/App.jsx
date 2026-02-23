import { useEffect, useMemo, useRef, useState } from 'react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const CAPACITY = Number(import.meta.env.VITE_WAITLIST_CAPACITY || 2000);

function getProgress(total) {
  if (!CAPACITY || CAPACITY < 1) return 0;
  return Math.min(100, Math.max(0, Math.round((total / CAPACITY) * 100)));
}

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile-script="true"]');
    if (existing) {
      if (window.turnstile) resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Turnstile'));
    document.head.appendChild(script);
  });
}

export default function App() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(Number(import.meta.env.VITE_WAITLIST_BASELINE || 1247));
  const [turnstileToken, setTurnstileToken] = useState('');
  const widgetIdRef = useRef(null);
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let mounted = true;

    loadTurnstileScript()
      .then(() => {
        if (!mounted || !window.turnstile || widgetIdRef.current != null) return;
        widgetIdRef.current = window.turnstile.render('#turnstile-slot', {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken('')
        });
      })
      .catch(() => {
        setMessage('Spam protection failed to load. Refresh and try again.');
        setStatus('error');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const spotsRemaining = Math.max(CAPACITY - count, 0);
  const progress = getProgress(count);

  async function submitWaitlist(event) {
    event.preventDefault();

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setStatus('error');
      setMessage('Please complete the spam check before submitting.');
      return;
    }

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
          turnstileToken
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
      setCount(data.waitlistCount || count + 1);
      setTurnstileToken('');

      if (window.turnstile && widgetIdRef.current != null) {
        window.turnstile.reset(widgetIdRef.current);
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

        <div className="syncy-meter" role="status" aria-label="Waitlist progress">
          <p>
            Join <strong>{count.toLocaleString()}</strong> others on the waitlist
          </p>
          <div className="syncy-bar-wrap">
            <div className="syncy-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="syncy-bar-meta">
            {progress}% full - {spotsRemaining.toLocaleString()} spots remaining
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

          {TURNSTILE_SITE_KEY ? <div id="turnstile-slot" className="syncy-turnstile" /> : null}

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
