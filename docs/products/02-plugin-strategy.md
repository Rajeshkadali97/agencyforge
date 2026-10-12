# Plugin Strategy

Reusable plugin catalog and governance for AgencyForge products.

Platform reference: `docs/architecture/10-plugin-system.md` (lifecycle API), `docs/architecture/12-extension-points.md`.

---

## Plugin categories

### Core Plugins
Built into runtime. No external API keys. Always available.

| Plugin ID | Capabilities | Status |
|---|---|---|
| `plugin.firecrawl` | `web.scrape`, `web.search`, `web.map` | Existing |
| `plugin.http` | `http.get`, `http.post`, `http.put`, `http.delete` | New |
| `plugin.filesystem` | `fs.read`, `fs.write`, `fs.list` | New (sandboxed path) |
| `plugin.scheduler` | `schedule.cron`, `schedule.once` | New (wraps `Scheduler`) |

### Business Plugins
Domain-specific integrations. Each requires external credentials.

| Plugin ID | Capabilities | Product(s) | Service |
|---|---|---|---|
| `plugin.hubspot` | `crm.create-contact`, `crm.update-deal`, `crm.read-contact` | Revenue Engine | HubSpot API |
| `plugin.salesforce` | `crm.create-contact`, `crm.update-deal` | Revenue Engine | Salesforce API |
| `plugin.sendgrid` | `email.send`, `email.schedule`, `email.track` | Revenue, Marketing | SendGrid |
| `plugin.mailchimp` | `email.create-campaign`, `email.schedule` | Marketing | Mailchimp |
| `plugin.twitter` | `social.post`, `social.schedule`, `social.read` | Marketing | Twitter/X API v2 |
| `plugin.linkedin` | `social.post`, `social.schedule` | Marketing | LinkedIn API |
| `plugin.google-sheets` | `sheets.read`, `sheets.write`, `sheets.append` | Research, Automation | Google Sheets |
| `plugin.airtable` | `airtable.read`, `airtable.write` | Automation | Airtable API |
| `plugin.slack` | `slack.send`, `slack.read-channel`, `slack.dm` | Automation | Slack API |
| `plugin.calendar` | `calendar.availability`, `calendar.book`, `calendar.cancel` | DentalOS | Google Calendar |
| `plugin.sms` | `comms.sms` | DentalOS | Twilio API |
| `plugin.dentrix` | `pms.read-patient`, `pms.write-appointment` | DentalOS | Dentrix G6 API |
| `plugin.insurance` | `insurance.check-eligibility` | DentalOS | Availity API |
| `plugin.webhook` | `trigger.webhook`, `webhook.emit` | Automation | Inbound HTTP |

### AI Plugins
Model capability extensions beyond the core provider chain.

| Plugin ID | Capabilities | Use cases |
|---|---|---|
| `plugin.tts` | `tts.synthesize`, `tts.voices` | Voice Assistant |
| `plugin.stt` | `stt.transcribe`, `stt.stream` | Voice Assistant |
| `plugin.wake-word` | `wakeword.detect` | Voice Assistant |
| `plugin.image-gen` | `image.generate`, `image.edit` | Website Builder, Marketing |
| `plugin.embeddings` | `embeddings.create`, `embeddings.search` | Research, Memory |
| `plugin.vision` | `vision.describe`, `vision.ocr` | DentalOS (X-ray), Website Builder |
| `plugin.code-executor` | `code.execute-sandbox` | Automation, Website Builder |

### Developer Plugins
Build and deployment tooling.

| Plugin ID | Capabilities | Use cases |
|---|---|---|
| `plugin.git` | `git.commit`, `git.push`, `git.read-diff` | Website Builder |
| `plugin.vercel` | `deploy.preview`, `deploy.production`, `deploy.status` | Website Builder |
| `plugin.github` | `github.pr`, `github.issue`, `github.read-file` | Developer tooling |
| `plugin.pdf-export` | `export.pdf` | Research Studio, DentalOS |
| `plugin.canva` | `design.create-from-template`, `design.export` | Marketing Studio |
| `plugin.figma` | `figma.read-design`, `figma.export-assets` | Website Builder |

### Enterprise Plugins
Governance and compliance for regulated deployments.

| Plugin ID | Capabilities | Use cases |
|---|---|---|
| `plugin.sso` | `auth.sso-validate`, `auth.session` | All products (enterprise auth) |
| `plugin.audit-log` | `audit.log-event`, `audit.query` | DentalOS, Revenue Engine |
| `plugin.vault` | `secrets.read`, `secrets.write` | All products (credential mgmt) |
| `plugin.data-masking` | `pii.mask`, `pii.detect` | DentalOS, Revenue Engine |
| `plugin.s3` | `storage.upload`, `storage.download`, `storage.list` | Website Builder, Research |
| `plugin.ldap` | `ldap.authenticate`, `ldap.group-check` | Enterprise deployments |

---

## Loading lifecycle

Two-phase (platform-provided — `docs/architecture/10-plugin-system.md`):

```
Phase 1 — Register manifest
  pluginRegistry.register(manifest)
  → manifest stored; plugin NOT yet active; capabilities unavailable

Phase 2 — Activate with config
  pluginRegistry.activate(pluginId, config)
  → manifest.create(config) called
  → instance.isConfigured() checked
  → true: active, capabilities available
  → false: skipped with warning; runtime continues
```

Product packages register and activate their plugins in their own bootstrap entry point. Platform guarantee: activation failures are caught and skipped — they do not crash the runtime.

---

## Plugin configuration

Env var convention: `PLUGIN_<PLUGIN_NAME_UPPER>_<KEY_UPPER>`

```typescript
await pluginRegistry.activate('plugin.sendgrid', {
  apiKey: process.env['PLUGIN_SENDGRID_API_KEY'] ?? '',
});

await pluginRegistry.activate('plugin.hubspot', {
  accessToken: process.env['PLUGIN_HUBSPOT_ACCESS_TOKEN'] ?? '',
  portalId:    process.env['PLUGIN_HUBSPOT_PORTAL_ID'] ?? '',
});
```

`isConfigured()` returns `false` when any required field is empty — plugin excluded from capability routing automatically.

---

## Permissions model

RC1: no capability-level access control. Any active agent can invoke any active plugin capability. Enforce at the agent layer for sensitive capabilities:

```typescript
protected async onExecute(context: ExecutionContext, input: unknown): Promise<AgentResult> {
  if (!this.allowedCapabilities.includes(capability)) {
    return { success: false, error: 'Agent not authorized for capability' };
  }
  // ...
}
```

**Roadmap:**

| Version | Control |
|---|---|
| Now | Agent self-enforcement (manual, per-agent) |
| v1.5 | `agentCapabilityPermissions` in agent manifest, enforced by `PluginRegistry.invoke()` |
| v2.0 | Per-agent plugin auth tokens; remote plugin model |

---

## Sandboxing

RC1: no process-level sandboxing. All plugins run in the runtime Node.js process.

**Mitigation now:**
- All `plugin.invoke()` calls wrapped in try/catch by the calling agent
- `dispose()` must clean up all timers and connections
- `plugin.filesystem` must restrict paths to a declared sandbox root (enforced in plugin, not by platform)

**v2.0 plan:** Remote plugin model — plugin runs as a separate process, called via IPC or HTTP (`docs/ROADMAP.md` v2.0.4).

---

## Versioning

### Plugin version (semver in manifest)

- `MAJOR` — breaking change to capability input/output schema
- `MINOR` — new capabilities added; existing unchanged
- `PATCH` — bug fix; no schema change

```typescript
export const SendGridPluginManifest: PluginManifest = {
  id: 'plugin.sendgrid',
  version: '1.0.0',
  capabilities: [
    { name: 'email.send', version: '1.0.0', description: 'Send a transactional email' },
  ],
};
```

### Capability versioning (v1.5)

Until `docs/ROADMAP.md` v1.5.7 lands, pin agent–plugin compatibility in `IMPLEMENTATION_LOG.md`.

Post-v1.5: `pluginRegistry.getByCapability('email.send@^1')` supports version ranges.

### Upgrade policy

| Change type | Safe to deploy without agent update? |
|---|---|
| Patch | Yes |
| Minor | Yes — test new capabilities don't conflict |
| Major | No — pin old + new IDs during migration (`plugin.sendgrid-v1`, `plugin.sendgrid-v2`) |

---

## Plugin development checklist

- [ ] `isConfigured()` returns `false` when any required env var absent
- [ ] `invoke()` throws typed error for unknown capabilities (never silent)
- [ ] `dispose()` clears all timers and connections
- [ ] No singleton state surviving `dispose()` + re-activate
- [ ] Capability names: dot notation (`email.send` not `email-send`)
- [ ] Plugin ID: dot notation (`plugin.sendgrid`)
- [ ] Env var convention: `PLUGIN_<NAME>_<KEY>`
- [ ] Test in `runtime/src/tests/`: activate + invoke + dispose

---

## Summary

| Category | Plugins | Existing | New needed |
|---|---|---|---|
| Core | 4 | 1 | 3 |
| Business | 14 | 0 | 14 |
| AI | 7 | 0 | 7 |
| Developer | 6 | 0 | 6 |
| Enterprise | 6 | 0 | 6 |
| **Total** | **37** | **1** | **36** |
