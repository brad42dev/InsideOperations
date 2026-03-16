import { api } from './client'

export interface MfaMethodStatus {
  method_type: string
  status: string
  verified_at: string | null
}

export interface MfaStatus {
  enabled: boolean
  methods: MfaMethodStatus[]
  has_recovery_codes: boolean
}

export interface EnrollTotpResponse {
  secret: string
  otpauth_uri: string
  manual_entry_key: string
}

export interface VerifyEnrollmentResponse {
  recovery_codes: string[]
}

export interface MfaChallengeResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export const mfaApi = {
  getStatus: () => api.get<MfaStatus>('/api/auth/mfa/status'),

  enrollTotp: () => api.post<EnrollTotpResponse>('/api/auth/mfa/enroll', {}),

  verifyEnrollment: (code: string) =>
    api.post<VerifyEnrollmentResponse>('/api/auth/mfa/verify', { code }),

  disableTotp: () => api.delete<{ message: string }>('/api/auth/mfa/totp'),

  challenge: (userId: string, code: string) =>
    api.post<MfaChallengeResponse>('/api/auth/mfa/challenge', {
      user_id: userId,
      code,
    }),

  recover: (userId: string, recoveryCode: string) =>
    api.post<MfaChallengeResponse>('/api/auth/mfa/recover', {
      user_id: userId,
      recovery_code: recoveryCode,
    }),
}
