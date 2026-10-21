import { resetAuditStore } from './auditStore';
import { resetBookingStore } from './bookingStore';
import { resetFacilityStore } from './facilityStore';
import { resetProfileStore } from './profileStore';
import { resetReferenceStore } from './referenceStore';
import { resetTermsStore } from './termsStore';
import { resetUserStore } from './userStore';

/** Back to the seed data, undoing every change an administrator or an applicant made. */
export function resetMockStores() {
  resetBookingStore();
  resetFacilityStore();
  resetUserStore();
  resetReferenceStore();
  resetTermsStore();
  resetAuditStore();
  resetProfileStore();
}
