import { definePlugin } from "nanoauth/utils";

export interface MagicLinkConfig {
  sendEmail: (email: string, link: string) => Promise<void>;
  generateToken: () => string;
}

export const magicLinkPlugin = definePlugin((config: MagicLinkConfig) => ({
  name: 'magic-link',

  async setup(auth) {
    return {
      sendMagicLink: async (email: string) => {
        try {
          auth.setState('isLoading', true);

          console.log("STATE: ", await auth.getState())

          const token = config.generateToken();
          const link = `https://myapp.com/auth/verify?token=${token}`;

          console.log({ token })
          console.log({ link })

          await config.sendEmail(email, link);

          auth.setState('isLoading', false);
          console.log("STATE: ", await auth.getState())
        } catch (error) {
          auth.setState('error', error);
          auth.setState('isLoading', false);

          auth.emit('onError', error);
        }
      }
    };
  }
}));