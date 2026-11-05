import type { Channel, Tx } from '@solink/db';
import { render } from './templates';

export { TEMPLATES, render } from './templates';

/** Interface Messaging (SMS / WhatsApp / email). Simulation : écrit dans Notification → /demo/boite. */
export interface Messaging {
  send(
    db: Tx,
    msg: { to: string; channels: Channel[]; template: string; vars?: Record<string, string | number>; link?: string; at: Date },
  ): Promise<void>;
}

export const simMessaging: Messaging = {
  async send(db, { to, channels, template, vars = {}, link, at }) {
    const { subject, body } = render(template, vars);
    for (const channel of channels) {
      await db.notification.create({ data: { recipient: to.toLowerCase(), channel, template, subject, body, link, at } });
    }
  },
};

export const messaging: Messaging = simMessaging;
