import type { IEmailProvider } from "./email-provider.interface";

/**
 * Global provider registry. Providers are registered at import time
 * (each provider module calls `registerProvider` at the bottom of the
 * file). The registry is consumed by `EmailService` to resolve
 * provider ids to concrete implementations.
 *
 * The registry is intentionally a plain `Map` — no dependency
 * injection container, no reflection, no magic. Contributors who add
 * a new provider only need to:
 *
 *   1. Create `providers/<name>.provider.ts` implementing `IEmailProvider`.
 *   2. Register the instance via `registerProvider(...)`.
 *   3. Import the module from `providers/index.ts`.
 */
const registry = new Map<string, IEmailProvider>();

export function registerProvider(provider: IEmailProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): IEmailProvider | undefined {
  return registry.get(id);
}

export function getAllProviders(): ReadonlyMap<string, IEmailProvider> {
  return registry;
}
