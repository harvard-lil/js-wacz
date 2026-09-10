import { constants, createPublicKey, verify, X509Certificate } from 'node:crypto'
import { assertValidWACZSignatureFormat } from './assertions.js'

/**
 * Check the signer's response against the requested manifest hash and included key.
 * This checks cryptographic consistency, not certificate trust or RFC 3161 timestamps.
 */
export const assertValidWACZSignature = (signedData, expectedHash) => {
  assertValidWACZSignatureFormat(signedData)
  if (signedData.hash !== expectedHash) {
    throw new Error('Signature response hash does not match datapackage.json.')
  }

  const key = signedData.publicKey
    ? createPublicKey({ key: Buffer.from(signedData.publicKey, 'base64'), format: 'der', type: 'spki' })
    : new X509Certificate(signedData.domainCert).publicKey
  const signature = Buffer.from(signedData.signature, 'base64')
  const message = Buffer.from(expectedHash, 'utf8')
  let valid = false

  if (key.asymmetricKeyType === 'ec') {
    // Python authsign/wacz-signing emit DER; Web Crypto emits IEEE P1363.
    valid = verify('sha256', message, { key, dsaEncoding: 'der' }, signature) ||
      verify('sha256', message, { key, dsaEncoding: 'ieee-p1363' }, signature)
  } else if (key.asymmetricKeyType === 'rsa' && !signedData.publicKey) {
    // Existing domain signers also support RSA certificates with PKCS#1 v1.5.
    valid = verify('sha256', message, { key, padding: constants.RSA_PKCS1_PADDING }, signature)
  }

  if (!valid) throw new Error('Signature does not verify with the supplied public key.')
}
