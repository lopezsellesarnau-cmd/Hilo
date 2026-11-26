/**
 * The version of the consent text she accepts (src/app/consent.tsx). Bump when the text changes: her phone then
 * shows the new text once more before Home, because a new use of her data needs her yes again (GDPR).
 * v2 (20 oct): one sentence for the family about what she talked about
 * v3 (30 oct): her voice is never kept (it said it was); the talks' text is deleted after 90 days
 * v4 (10 nov): messages she asks Hilo to send, and the alert to her family after a fall or feeling unwell (org-v2 too)
 * v5 (27 nov): Hilo rings her at her chat time (again if she doesn't answer, then the family is told), and her family
 *              can call her inside Hilo; calls are not recorded (org-v3 too)
 */
export const CONSENT_VERSION = '2026-11-v5';
// When an organisation signed her up: a text of its own, so its version is recorded apart
export const ORG_CONSENT_VERSION = '2026-11-org-v3';
