export const createOAuthTransporter = async () => {
  const { default: gmailProvider } =
    await import("../services/email/providers/gmail.provider");
  return gmailProvider.createTransporter();
};
