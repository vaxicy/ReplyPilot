// utils/logger.js
// Lightweight logger. Verbose logging is disabled by default to protect user
// privacy (we never log API keys, email content, or secrets).
window.RP = window.RP || {};

(function (RP) {
  'use strict';

  var PREFIX = '[ReplyPilot]';

  // Set to true only for local debugging. Never enable in production builds
  // because it could accidentally surface sensitive data.
  var DEBUG = false;

  function safe() {
    // No-op sink: guarantees secrets are never written to console.
    return;
  }

  RP.logger = {
    debug: function () {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.debug(PREFIX, ...arguments);
      }
    },
    info: function () {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.info(PREFIX, ...arguments);
      }
    },
    warn: function () {
      // eslint-disable-next-line no-console
      console.warn(PREFIX, ...arguments);
    },
    error: function () {
      // eslint-disable-next-line no-console
      console.error(PREFIX, ...arguments);
    },
    // Explicitly reserved to document that secret logging is forbidden.
    secret: safe
  };
})(window.RP);
