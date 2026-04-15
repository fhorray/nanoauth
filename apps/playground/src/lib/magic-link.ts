import { AuthCoreInstance, Plugin, User } from "nanoauth";
import { definePlugin } from "nanoauth/utils";

export interface MagicLinkConfig {
  sendEmail: (email: string, link: string) => Promise<void>;
  generateToken: () => string;
}


export const magicLinkPlugin = definePlugin((config: MagicLinkConfig) => ({
  name: 'magic-link', // Must be unique

  // 3. The setup function is called once during initialization
  async setup(auth) {

    // Inject a brand new method into the auth instance
    auth.sendMagicLink = async (email: string) => {
      try {
        auth.setState('isLoading', true); // Update internal state

        const token = config.generateToken();
        const link = `https://myapp.com/auth/verify?token=${token}`;

        await config.sendEmail(email, link);

        auth.setState('isLoading', false);
      } catch (error) {
        auth.setState('error', error);
        auth.setState('isLoading', false);

        // Emit a reactive event if things fail
        auth.emit('onError', error);
      }
    }
  }
}));