/**
 * Tamper Guard — Client-side DOM tampering detection.
 *
 * Monitors the DOM for injected dangerous elements (scripts, iframes,
 * forms, embeds) and periodically audits links for hijacking.
 * Shows a warning banner if tampering is detected.
 *
 * The link audit looks only at links the page did not arrive with: one added after the page loaded,
 * or one whose address changed since. A link in the page as this site served it is the site's own
 * (the credits page links each license's publisher, the privacy policy each company it names), and
 * an attacker who could change the served page could change this script too, so it is not audited.
 * Before 2026-11-19 every link was held to ALLOWED_DOMAINS, and /credits and /privacy showed the
 * warning to every visitor three seconds after load (tests/tamper-guard.spec.ts).
 */

const DANGEROUS_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'FORM', 'OBJECT', 'EMBED', 'APPLET',
]);

// Allowed domains for link audit (ecosystem + common safe targets)
const ALLOWED_DOMAINS = new Set([
  // DJC ecosystem
  'davidjcharlot.com', 'www.davidjcharlot.com',
  'davidjpublishing.com', 'www.davidjpublishing.com',
  'voyagetracable.com', 'www.voyagetracable.com',
  'fabric.davidjcharlot.com',
  'lore.davidjcharlot.com',
  'publishing.davidjcharlot.com',
  // OpenIE ecosystem
  'openie.dev', 'www.openie.dev',
  'products.openie.dev', 'projects.openie.dev',
  'energy.openie.dev', 'blog.openie.dev',
  // Joule ecosystem
  'joule-lang.org', 'www.joule-lang.org',
  'joule.openie.dev',
  'jouledb.org', 'www.jouledb.org',
  // Other owned sites
  'aurasense.ai', 'www.aurasense.ai',
  'neuroplay.aurasense.ai',
  'cbio.io', 'www.cbio.io',
  'c3i.tech', 'www.c3i.tech',
  'pattern-lang.ai', 'www.pattern-lang.ai',
  'playdimension.ai', 'www.playdimension.ai',
  'arena.playdimension.ai',
  'inspiredmile.com', 'www.inspiredmile.com',
  'sonnetman.inspiredmile.com',
  'chessfighter.inspiredmile.com',
  'create.inspiredmile.com',
  // Social & professional
  'linkedin.com', 'www.linkedin.com',
  'twitter.com', 'www.twitter.com',
  'x.com', 'www.x.com',
  'youtube.com', 'www.youtube.com',
  'facebook.com', 'www.facebook.com',
  // Common safe domains
  'github.com', 'www.github.com',
  'huggingface.co', 'www.huggingface.co',
  'amazon.com', 'www.amazon.com',
  'books.apple.com',
  'play.google.com',
  // Academic & research
  'scholar.google.com',
  'patents.justia.com',
  'doi.org', 'www.doi.org',
  'www.sbir.gov',
  'rust-lang.org', 'www.rust-lang.org',
  // Conference & scientific organizations
  'cbmsociety.org', 'www.cbmsociety.org',
  'electrokinetics.net', 'www.electrokinetics.net',
  'microfluidics-association.org', 'www.microfluidics-association.org',
  'microtas2026.org', 'www.microtas2026.org',
  'scixconference.org', 'www.scixconference.org',
  'www.aesociety.org',
  'www.dep2026.org',
  'www.dielectrophoresissociety.org',
  // Academic lab & institutional sites
  'faculty.sites.uci.edu',
  'faculty.thecollege.asu.edu',
  'sites.google.com',
  // Business & events
  'events.ringcentral.com',
  'southernshakespearefestival.org', 'www.southernshakespearefestival.org',
  'greenlab.di.uminho.pt',
]);

/** Grace period (ms) to allow Astro hydration before monitoring starts */
export const GRACE_PERIOD = 3000;

/** Link audit interval (ms) */
const LINK_AUDIT_INTERVAL = 30000;

let warningShown = false;

function showTamperWarning(reason: string) {
  if (warningShown) return;
  warningShown = true;

  console.warn(`[Tamper Guard] ${reason}`);

  const banner = document.createElement('div');
  banner.id = 'tamper-guard-warning';
  // Inline styles resist CSS-based suppression
  banner.setAttribute('style', [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:2147483647',
    'background:#DC2626',
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'font-size:14px',
    'font-weight:600',
    'text-align:center',
    'padding:12px 20px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
  ].join(';'));

  const domain = window.location.hostname;
  banner.textContent = `⚠ This page may have been modified. Please reload or navigate directly to ${domain}`;

  document.body.prepend(banner);
}

function isDangerousNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  const tag = el.tagName;

  // Dangerous element injection
  if (DANGEROUS_TAGS.has(tag)) return true;

  // Style/Link injected outside <head> (visual spoofing)
  if ((tag === 'STYLE' || (tag === 'LINK' && el.getAttribute('rel') === 'stylesheet'))
      && !el.closest('head')) {
    return true;
  }

  // Check children recursively (attacker might wrap dangerous elements)
  for (const child of el.children) {
    if (isDangerousNode(child)) return true;
  }

  return false;
}

/** Each link the page arrived with, and its address then. */
type Served = WeakMap<Element, string>;

function servedLinks(): Served {
  const served: Served = new WeakMap();
  document.querySelectorAll('a[href]').forEach((a) => served.set(a, (a as HTMLAnchorElement).href));
  return served;
}

function auditLinks(served: Served) {
  const links = document.querySelectorAll('a[href]');
  for (const link of links) {
    const href = (link as HTMLAnchorElement).href;
    if (!href) continue;

    // A link as the page was served, at the address it was served with.
    if (served.get(link) === href) continue;

    // Skip non-http links (mailto:, tel:, #, javascript:void, blob:, data:)
    if (!href.startsWith('http://') && !href.startsWith('https://')) continue;

    try {
      const url = new URL(href);
      const domain = url.hostname;

      // Allow same-origin
      if (domain === window.location.hostname) continue;

      // Allow known domains
      if (ALLOWED_DOMAINS.has(domain)) continue;

      // Flag unknown external domain
      showTamperWarning(`Suspicious link detected: ${href}`);
      return;
    } catch {
      // Malformed URL
      continue;
    }
  }
}

export function initTamperGuard() {
  // Record all scripts present at load time
  const knownScripts = new WeakSet<Element>();
  document.querySelectorAll('script').forEach((s) => knownScripts.add(s));
  // And every link, now: this runs as a module script, after the served page has been parsed.
  const served = servedLinks();

  // Wait for Astro hydration to complete before monitoring
  setTimeout(() => {
    // Snapshot scripts after hydration
    document.querySelectorAll('script').forEach((s) => knownScripts.add(s));

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;

          // Skip known scripts (present at load or during hydration)
          if (el.tagName === 'SCRIPT' && knownScripts.has(el)) continue;

          if (isDangerousNode(el)) {
            showTamperWarning(
              `Unauthorized ${el.tagName.toLowerCase()} element injected into the page.`
            );
            return;
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Periodic link integrity audit
    auditLinks(served);
    setInterval(() => auditLinks(served), LINK_AUDIT_INTERVAL);
  }, GRACE_PERIOD);
}
