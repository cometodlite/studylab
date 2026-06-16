import { createRemoteJWKSet, jwtVerify } from 'jose';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function verifyFirebaseToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  if (!payload.sub) throw new Error('No uid in token');
  return payload.sub;
}
