export interface KycVerificationRequest {
  nin: string;
  fullName: string;
  dateOfBirth?: string;
  under18?: boolean;
  guardianNin?: string;
  guardianFullName?: string;
}

export interface KycVerificationResult {
  success: boolean;
  provider: 'local_manual' | 'prembly' | 'dojah';
  status: 'match' | 'manual_review_required' | 'mismatch';
  verifiedLegalName?: string;
  notes?: string;
}

export interface IKycProvider {
  readonly name: string;
  verifyNin(request: KycVerificationRequest): Promise<KycVerificationResult>;
}

function compareNames(typedName: string, registryName: string): number {
  const typedTokens = typedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const regTokens = registryName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (typedTokens.length === 0 || regTokens.length === 0) return 0;
  const matches = typedTokens.filter(t => regTokens.includes(t)).length;
  return Math.round((matches / Math.max(typedTokens.length, 2)) * 100);
}

/**
 * Option A (Launch default): Local encrypted submission reviewed by Shop It Trust & Safety moderators.
 */
export class LocalManualKycProvider implements IKycProvider {
  readonly name = 'local_manual';

  async verifyNin(_request: KycVerificationRequest): Promise<KycVerificationResult> {
    return {
      success: false,
      provider: 'local_manual',
      status: 'manual_review_required',
      notes: 'Queued for Trust & Safety moderator verification.',
    };
  }
}

/**
 * Prembly (IdentityPass) NIN Lookup Adapter.
 * Enable cleanly by setting KYC_PROVIDER=prembly + PREMBLY_API_KEY + PREMBLY_APP_ID.
 */
export class PremblyKycProvider implements IKycProvider {
  readonly name = 'prembly';

  async verifyNin(request: KycVerificationRequest): Promise<KycVerificationResult> {
    const apiKey = (process.env.PREMBLY_API_KEY || '').trim();
    if (!apiKey) {
      return {
        success: false,
        provider: 'prembly',
        status: 'manual_review_required',
        notes: 'Prembly key not configured; routed to manual review.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.prembly.com/identity-pass/verification/nin', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'app-id': process.env.PREMBLY_APP_ID || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number: request.nin }),
        signal: controller.signal,
      });

      const data: any = await response.json().catch(() => ({}));
      if (response.ok && data.status && data.data) {
        const nimcName = `${data.data.firstname || ''} ${data.data.middlename || ''} ${data.data.surname || ''}`.trim();
        const nimcDob = data.data.birthdate || data.data.dob || '';
        const nameScore = compareNames(request.fullName, nimcName);
        const dobMatch = Boolean(
          request.dateOfBirth &&
            nimcDob &&
            request.dateOfBirth.replace(/-/g, '') === nimcDob.replace(/-/g, '')
        );

        return {
          success: true,
          provider: 'prembly',
          status: nameScore >= 60 && dobMatch ? 'match' : 'manual_review_required',
          verifiedLegalName: nimcName || undefined,
        };
      }
    } catch (err: any) {
      console.warn('[KYC:Prembly] Lookup error, routing to manual review:', err.message);
    } finally {
      clearTimeout(timeout);
    }

    return {
      success: false,
      provider: 'prembly',
      status: 'manual_review_required',
    };
  }
}

/**
 * Dojah NIN Lookup Adapter.
 * Enable cleanly by setting KYC_PROVIDER=dojah + DOJAH_APP_ID + DOJAH_PRIVATE_KEY.
 */
export class DojahKycProvider implements IKycProvider {
  readonly name = 'dojah';

  async verifyNin(request: KycVerificationRequest): Promise<KycVerificationResult> {
    const appId = (process.env.DOJAH_APP_ID || '').trim();
    const privateKey = (process.env.DOJAH_PRIVATE_KEY || '').trim();
    if (!appId || !privateKey) {
      return {
        success: false,
        provider: 'dojah',
        status: 'manual_review_required',
        notes: 'Dojah credentials not configured; routed to manual review.',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `https://api.dojah.io/api/v1/kyc/nin?nin=${encodeURIComponent(request.nin)}`,
        {
          method: 'GET',
          headers: {
            AppId: appId,
            Authorization: privateKey,
          },
          signal: controller.signal,
        }
      );

      const data: any = await response.json().catch(() => ({}));
      const entity = data?.entity;
      if (response.ok && entity) {
        const nimcName = `${entity.first_name || ''} ${entity.middle_name || ''} ${entity.last_name || ''}`.trim();
        const nimcDob = entity.date_of_birth || '';
        const nameScore = compareNames(request.fullName, nimcName);
        const dobMatch = Boolean(
          request.dateOfBirth &&
            nimcDob &&
            request.dateOfBirth.replace(/-/g, '') === nimcDob.replace(/-/g, '')
        );

        return {
          success: true,
          provider: 'dojah',
          status: nameScore >= 60 && dobMatch ? 'match' : 'manual_review_required',
          verifiedLegalName: nimcName || undefined,
        };
      }
    } catch (err: any) {
      console.warn('[KYC:Dojah] Lookup error, routing to manual review:', err.message);
    } finally {
      clearTimeout(timeout);
    }

    return {
      success: false,
      provider: 'dojah',
      status: 'manual_review_required',
    };
  }
}

export function getKycProvider(override?: string): IKycProvider {
  const mode = (override || process.env.KYC_PROVIDER || 'local').trim().toLowerCase();
  if (mode === 'prembly') return new PremblyKycProvider();
  if (mode === 'dojah') return new DojahKycProvider();
  return new LocalManualKycProvider();
}
