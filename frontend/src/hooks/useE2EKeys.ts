/**
 * useE2EKeys hook
 * Runs once when the user becomes authenticated.
 * Ensures the user has an ECDH key pair in IndexedDB and that the
 * public key is uploaded to the server.
 *
 * Failures are silent — E2E encryption is best-effort and should
 * never block the user from using the app.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@stores/authStore';
import { ensureKeyPair, getPublicKeyString } from '@services/crypto';
import { apiService } from '@services/api';

export function useE2EKeys() {
  const { user, isAuthenticated } = useAuth();
  const uploadedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || uploadedRef.current) return;

    (async () => {
      try {
        await ensureKeyPair();
        const publicKey = await getPublicKeyString();
        await apiService.users.uploadPublicKey(publicKey);
        uploadedRef.current = true;
      } catch {
        // Silently swallow — E2E is optional
      }
    })();
  }, [isAuthenticated, user]);
}
