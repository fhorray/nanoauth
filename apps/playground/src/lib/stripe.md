# Stripe Plugin for NanoAuth 💳

The Stripe plugin provides a seamless integration between **NanoAuth** and **Stripe**, offering automated customer management, subscription lifecycle synchronization, and a self-service billing portal.

## Prerequisites

Before configuring the plugin, ensure you have:
1.  A [Stripe Account](https://stripe.com).
2.  [Stripe CLI](https://stripe.com/docs/stripe-cli) installed for local testing.
3.  [Ngrok](https://ngrok.com) for exposing your local webhook endpoint.

## Environment Variables

Add the following keys to your `.dev.vars` file in the playground:

```bash
# Your Secret Key from Stripe Dashboard (Developers > API keys)
STRIPE_SECRET_KEY=sk_test_...

# Your Webhook Secret (Obtained via Stripe CLI or Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Plugin Configuration

Initialize the plugin within your `nanoauth` configuration in `src/lib/auth.ts`:

```typescript
import { stripePlugin } from './stripe';
import Stripe from 'stripe';

export const auth = nanoauth({
  // ... your adapter and other plugins
  plugins: [
    stripePlugin({
      stripeClient: new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-01-27.acacia', // Use a modern version
      }),
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true, // Automatically creating Stripe customers
      successUrl: 'http://localhost:3000/dashboard?success=true',
      cancelUrl: 'http://localhost:3000/pricing?cancel=true',
      plans: [
        { name: 'starter', priceId: 'price_XXXXXX', limits: { projects: 3 } },
        { name: 'pro', priceId: 'price_YYYYYY', limits: { projects: 10 } }
      ]
    })
  ]
});
```

## Webhook Configuration

The plugin exposes a dedicated endpoint at `/api/auth/stripe/webhook`.

### Required Events
To maintain data integrity, you **must** enable the following events in the Stripe Dashboard or CLI:
- `checkout.session.completed`: Dispatched when a payment is successful.
- `customer.subscription.deleted`: Dispatched when a subscription is canceled or expires.

### Local Testing
To test the webhook locally using Ngrok:

1.  Start Ngrok:
    ```bash
    ngrok http 3000
    ```
2.  Start Stripe CLI listening:
    ```bash
    stripe listen --forward-to https://YOUR_NGROK_URL/api/auth/stripe/webhook
    ```
3.  Copy the `whsec_...` secret printed by the CLI into your `.dev.vars`.

## Usage & API

The plugin injects a `stripe` namespace into your `auth` instance:

### Launch Billing Portal
Generate a URL for the Stripe Customer Portal where users can manage their cards and plans:
```typescript
const portalUrl = await auth.stripe.getPortalUrl('http://localhost:3000/dashboard');
```

### Get Active Subscription
Retrieve the current user's active subscription details from the database:
```typescript
const subscription = await auth.stripe.getActiveSubscription();
// Returns { id, plan, status, ... } or null
```

## Data Persistence
The plugin assumes the presence of a `subscriptions` table. It automatically:
- Updates the `stripeCustomerId` and `subscriptionStatus` fields in the `users` table.
- Records all subscription events in the `subscriptions` table via the Drizzle adapter.

---
Proudly provided by Antigravity.
