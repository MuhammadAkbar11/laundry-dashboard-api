export type { IEmailProvider } from "./email-provider.interface";
export { registerProvider, getProvider, getAllProviders } from "./registry";

/**
 * Built-in providers. Importing this module triggers registration of
 * every provider via side-effect imports. `EmailService` imports from
 * this barrel so the providers are available before any send is
 * attempted.
 */
import "./gmail.provider";
import "./zohomail.provider";
