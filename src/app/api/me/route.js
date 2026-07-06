import { resolveRelayActor } from '@/server/auth/actor.js';
import { relayRoute } from '@/server/http/relayRoute.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return relayRoute(async () => {
    const actor = await resolveRelayActor(request);
    const { user } = actor;

    return {
      data: {
        authProvider: actor.authProvider,
        externalAuthAccount: actor.externalAuthAccount
          ? {
              provider: actor.externalAuthAccount.provider,
              email: actor.externalAuthAccount.email,
              displayName: actor.externalAuthAccount.displayName,
            }
          : null,
        user: {
          id: user.id,
          userRef: user.userRef,
          email: user.email,
          name: user.name,
          status: user.status,
          isOperator: Boolean(user.isOperator),
        },
      },
    };
  });
}
