export const facilityLink = (id: string) => `/facilities/${encodeURIComponent(id)}`;
export const bookingConfirmationLink = (id: string) =>
  `/bookings/${encodeURIComponent(id)}/confirmation`;
export const bookingLink = (id: string) => `/bookings/${encodeURIComponent(id)}`;
