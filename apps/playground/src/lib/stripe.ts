import { definePlugin } from 'nanoauth/utils';
import type { User, AuthCoreInstance } from 'nanoauth';
import Stripe from 'stripe';
import { db, userRepository } from '../db/client';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

export interface StripePlan {
    name: string;
    priceId: string;
    limits?: Record<string, any>;
}

export interface StripeConfig {
    stripeClient: Stripe;
    stripeWebhookSecret: string;
    createCustomerOnSignUp?: boolean;
    successUrl: string;
    cancelUrl: string;
    plans?: StripePlan[];
}

/**
 * NanoAuth Stripe Plugin 💳
 * 
 * Provides automated customer creation, subscription management,
 * and webhook handling.
 */
export const stripePlugin = definePlugin((config: StripeConfig) => ({
    name: 'stripe',

    // 1. Logic to register custom routes
    endpoints: {
        // GET /api/auth/stripe/checkout?plan=pro
        upgrade: {
            path: '/stripe/upgrade',
            method: 'POST',
            handler: async (req, auth) => {
                const { user } = await auth.getSession(req);
                if (!user) {
                    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
                }

                const body = await req.json().catch(() => ({}));
                const planName = body.plan;
                const plan = config.plans?.find(p => p.name === planName);

                if (!plan) {
                    return new Response(JSON.stringify({ error: 'Invalid plan' }), { status: 400 });
                }

                // Create Checkout Session
                const session = await config.stripeClient.checkout.sessions.create({
                    customer: (user as any).stripeCustomerId || undefined,
                    customer_email: (user as any).stripeCustomerId ? undefined : user.email,
                    line_items: [{ price: plan.priceId, quantity: 1 }],
                    mode: 'subscription',
                    success_url: config.successUrl,
                    cancel_url: config.cancelUrl,
                    metadata: { userId: user.id, planName: plan.name }
                });

                return new Response(JSON.stringify({ url: session.url }));
            }
        },

        // Webhook handler with signature verification
        webhook: {
            path: '/stripe/webhook',
            method: 'POST',
            handler: async (req, auth) => {
                const signature = req.headers.get('stripe-signature');
                if (!signature) {
                    return new Response('Missing signature', { status: 400 });
                }

                try {
                    const body = await req.text();
                    const event = await config.stripeClient.webhooks.constructEventAsync(
                        body,
                        signature,
                        config.stripeWebhookSecret
                    );

                    console.log(`[STRIPE WEBHOOK] 🔔 Event Received: ${event.type}`);

                    // Handle specific events
                    switch (event.type) {
                        case 'checkout.session.completed': {
                            const session = event.data.object as Stripe.Checkout.Session;
                            const userId = session.metadata?.userId;
                            const planName = session.metadata?.planName;

                            if (userId && planName) {
                                // Update DB
                                await db.update(schema.users)
                                    .set({
                                        stripeCustomerId: session.customer as string,
                                        subscriptionStatus: 'active'
                                    })
                                    .where(eq(schema.users.id, userId));

                                await db.insert(schema.subscriptions).values({
                                    id: session.subscription as string,
                                    plan: planName,
                                    referenceId: userId,
                                    stripeCustomerId: session.customer as string,
                                    stripeSubscriptionId: session.subscription as string,
                                    status: 'active'
                                });

                                console.log(`[STRIPE] ✅ Subscription activated for user ${userId}`);
                            }
                            break;
                        }

                        case 'customer.subscription.deleted': {
                            const sub = event.data.object as Stripe.Subscription;
                            await db.update(schema.subscriptions)
                                .set({ status: 'canceled' })
                                .where(eq(schema.subscriptions.id, sub.id));

                            // Also update user status if needed
                            const userSub = await db.query.subscriptions.findFirst({
                                where: eq(schema.subscriptions.id, sub.id)
                            });
                            if (userSub) {
                                await db.update(schema.users)
                                    .set({ subscriptionStatus: 'canceled' })
                                    .where(eq(schema.users.id, userSub.referenceId));
                            }
                            break;
                        }
                    }

                    return new Response(JSON.stringify({ received: true }));
                } catch (err: any) {
                    console.error(`[STRIPE WEBHOOK ERROR] ❌ ${err.message}`);
                    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
                }
            }
        }
    },

    // 2. Lifecycle hooks
    hooks: (auth: AuthCoreInstance<any>) => ({
        afterSignup: async ({ user }) => {
            if (config.createCustomerOnSignUp) {
                console.log(`[STRIPE HOOK] 👤 Creating customer for ${user.email}...`);
                const customer = await config.stripeClient.customers.create({
                    email: user.email,
                    name: (user as any).name,
                    metadata: { userId: user.id }
                });

                // Update local user with Stripe ID
                await userRepository.update(user.id, { stripeCustomerId: customer.id } as any);
                console.log(`[STRIPE HOOK] ✅ Customer created: ${customer.id}`);
            }
        }
    }),

    // 3. Methods injected into the 'auth' object
    exports: (auth) => ({
        stripe: {
            getPortalUrl: async (user: User, returnUrl: string) => {
                if (!user || !(user as any).stripeCustomerId) {
                    throw new Error('User has no Stripe customer ID');
                }

                const session = await config.stripeClient.billingPortal.sessions.create({
                    customer: (user as any).stripeCustomerId,
                    return_url: returnUrl,
                });

                return session.url;
            },
            getActiveSubscription: async (userId: string) => {
                if (!userId) return null;

                return await db.query.subscriptions.findFirst({
                    where: (subs, { eq, and }) => and(
                        eq(subs.referenceId, userId),
                        eq(subs.status, 'active')
                    )
                });
            }
        }
    })
}));
