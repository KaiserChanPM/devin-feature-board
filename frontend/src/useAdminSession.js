import { useCallback, useEffect, useRef, useState } from 'react';
import { verifyAdmin } from './api.js';

const KEY = 'adminPasscode';
const STORAGE_ERROR = 'Admin mode needs session storage. Allow it and try again.';

export default function useAdminSession() {
  const [passcode, setPasscode] = useState(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);
  const attempt = useRef(0);

  const exit = useCallback((reason = null) => {
    ++attempt.current;
    setPasscode(null);
    setChecking(false);
    try {
      sessionStorage.removeItem(KEY);
      setMessage(reason);
    } catch {
      setMessage('Admin mode is off. Session storage could not be cleared; close this tab to discard it.');
    }
  }, []);

  const unlock = useCallback(async (value) => {
    const version = ++attempt.current;
    setChecking(true);
    setMessage(null);
    try {
      await verifyAdmin(value);
      if (version !== attempt.current) return;
      try {
        sessionStorage.setItem(KEY, value);
      } catch {
        throw new Error(STORAGE_ERROR);
      }
      setPasscode(value);
    } catch (err) {
      if (version !== attempt.current) return;
      setPasscode(null);
      if (err.status === 403) exit('Invalid admin passcode. Admin mode is off.');
      else setMessage(err.message);
    } finally {
      if (version === attempt.current) setChecking(false);
    }
  }, [exit]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(KEY);
      if (saved) unlock(saved);
    } catch {
      setMessage(STORAGE_ERROR);
    }
    return () => { ++attempt.current; };
  }, [unlock]);

  return { passcode, checking, message, unlock, exit };
}
