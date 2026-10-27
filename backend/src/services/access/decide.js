/** @param {{ expiresAt?: string | null, revoked?: boolean } | null | undefined} share */
export function shareLive(share, now = Date.now()) {
  if (!share || share.revoked) return false;
  if (share.expiresAt && Date.parse(share.expiresAt) <= now) return false;
  return true;
}

/**
 * Ownerless scans stay capability links. A private scan is readable by its
 * owner, or by a live share token when the route allows it.
 * @param {object | null | undefined} scan
 * @param {{ userId?: string, share?: { scanId: string, expiresAt?: string | null, revoked?: boolean } } | null | undefined} actor
 * @param {{ allowShare?: boolean }} [opts]
 */
export function canRead(scan, actor, { allowShare = false } = {}) {
  if (!scan) return false;
  if (!scan.ownerId) return true;
  if (actor?.userId && actor.userId === scan.ownerId) return true;
  if (allowShare && actor?.share?.scanId === scan.id && shareLive(actor.share)) return true;
  return false;
}

/** Repairs, verify, cancel, source, and share-management. Share tokens cannot write. */
export function canWrite(scan, actor) {
  if (!scan) return false;
  if (!scan.ownerId) return true;
  return Boolean(actor?.userId && actor.userId === scan.ownerId);
}
