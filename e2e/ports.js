'use strict';
/** Ports + URLs shared by the build script, the static server, Playwright config and the helpers. */
const MOCK_PORT = Number(process.env.MOCK_PORT || 8787);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 8788);
/** Web listeners = max Playwright workers (one isolated mock tenant each). */
const WEB_PORTS = Number(process.env.E2E_WEB_PORTS || 8);

module.exports = {
  MOCK_PORT,
  WEB_PORT,
  WEB_PORTS,
  MOCK_URL: `http://127.0.0.1:${MOCK_PORT}`,
  WEB_URL: `http://127.0.0.1:${WEB_PORT}`,
};
