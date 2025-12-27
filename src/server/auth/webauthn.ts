import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server'

export interface StoredPasskey {
  credentialId: string
  publicKey: string
  counter: number
  transports: string | null
}

const rpName = process.env.WEBAUTHN_RP_NAME || 'Business Finance Tracker'
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173'

export async function generatePasskeyRegistrationOptions(
  userId: string,
  userEmail: string,
  existingPasskeys: StoredPasskey[]
) {
  const excludeCredentials = existingPasskeys.map((passkey) => ({
    id: passkey.credentialId,
    type: 'public-key' as const,
    transports: passkey.transports
      ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }))

  return generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: userEmail,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })
}

export async function verifyPasskeyRegistration(
  response: Parameters<typeof verifyRegistrationResponse>[0]['response'],
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  })
}

export async function generatePasskeyAuthenticationOptions(
  allowCredentials?: StoredPasskey[]
) {
  const credentials = allowCredentials?.map((passkey) => ({
    id: passkey.credentialId,
    type: 'public-key' as const,
    transports: passkey.transports
      ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
      : undefined,
  }))

  return generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials,
    userVerification: 'preferred',
  })
}

export async function verifyPasskeyAuthentication(
  response: Parameters<typeof verifyAuthenticationResponse>[0]['response'],
  expectedChallenge: string,
  passkey: StoredPasskey
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64url'),
      counter: passkey.counter,
      transports: passkey.transports
        ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
        : undefined,
    },
  })
}
