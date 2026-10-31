// Passkeys (Face ID, Touch ID, a phone's screen lock) for the app when it runs in a browser. The app calls these with
// the server's options as JSON text and gets the device's answer back as JSON text; the conversion between the
// server's base64url strings and the browser's byte arrays happens here.
(function () {
  const toBytes = (b64url) => {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  };
  const toB64url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let text = '';
    for (const b of bytes) text += String.fromCharCode(b);
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  // The browser's error name ("NotAllowedError" when the person cancels or has no passkey) is what the app sees.
  const named = (error) => new Error((error && error.name) || 'Error');

  window.foodPasskey = {
    supported() {
      return Boolean(window.PublicKeyCredential && navigator.credentials);
    },
    async platformAvailable() {
      try {
        return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
      } catch (_) {
        return false;
      }
    },
    async create(optionsJson) {
      const o = JSON.parse(optionsJson);
      o.challenge = toBytes(o.challenge);
      o.user.id = toBytes(o.user.id);
      o.excludeCredentials = (o.excludeCredentials || []).map((c) => ({ ...c, id: toBytes(c.id) }));
      let credential;
      try {
        credential = await navigator.credentials.create({ publicKey: o });
      } catch (error) {
        throw named(error);
      }
      const r = credential.response;
      return JSON.stringify({
        id: credential.id,
        rawId: toB64url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment || undefined,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
          clientDataJSON: toB64url(r.clientDataJSON),
          attestationObject: toB64url(r.attestationObject),
          transports: typeof r.getTransports === 'function' ? r.getTransports() : [],
        },
      });
    },
    async get(optionsJson) {
      const o = JSON.parse(optionsJson);
      o.challenge = toBytes(o.challenge);
      o.allowCredentials = (o.allowCredentials || []).map((c) => ({ ...c, id: toBytes(c.id) }));
      let credential;
      try {
        credential = await navigator.credentials.get({ publicKey: o });
      } catch (error) {
        throw named(error);
      }
      const r = credential.response;
      return JSON.stringify({
        id: credential.id,
        rawId: toB64url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment || undefined,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: {
          clientDataJSON: toB64url(r.clientDataJSON),
          authenticatorData: toB64url(r.authenticatorData),
          signature: toB64url(r.signature),
          userHandle: r.userHandle ? toB64url(r.userHandle) : undefined,
        },
      });
    },
  };
})();
