/** The booking rules every facility starts with. Each facility's own values are set in administration. */
export const MOCK_AVAILABILITY_RULES = {
  minimumNoticeHours: 48,
  maximumHorizonDays: 90,
  minimumDurationMinutes: 60,
  /** A week is generous for a wedding or a conference, and too short to hold a hall for a season. */
  maximumBookingDays: 7,
} as const;
