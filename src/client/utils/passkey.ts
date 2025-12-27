import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { api } from '../api/client'
import type { AuthResponse } from '@shared/types'

export function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn()
}

export async function registerPasskey(deviceName?: string): Promise<boolean> {
  const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
    '/passkeys/register/options'
  )

  const attestationResponse = await startRegistration({ optionsJSON: options })

  await api.post('/passkeys/register/verify', {
    response: attestationResponse,
    deviceName,
  })

  return true
}

export async function loginWithPasskey(email?: string): Promise<AuthResponse> {
  const options = await api.post<PublicKeyCredentialRequestOptionsJSON>(
    '/passkeys/authenticate/options',
    email ? { email } : undefined
  )

  const assertionResponse = await startAuthentication({ optionsJSON: options })

  const result = await api.post<AuthResponse>('/passkeys/authenticate/verify', {
    response: assertionResponse,
    email,
  })

  return result
}

export async function signupWithPasskey(
  email: string,
  deviceName?: string
): Promise<AuthResponse> {
  const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
    '/passkeys/signup/options',
    { email }
  )

  const attestationResponse = await startRegistration({ optionsJSON: options })

  const result = await api.post<AuthResponse>('/passkeys/signup/verify', {
    email,
    response: attestationResponse,
    deviceName,
  })

  return result
}
