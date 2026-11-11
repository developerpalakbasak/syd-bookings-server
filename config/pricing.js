/**
 * ============================================================
 * SYD AIRPORT TRANSFER — PRICING CONFIGURATION
 * ============================================================
 * Update these values when the client provides final rates.
 * No other file needs to be changed — all fare calculation
 * reads from this single config.
 *
 * Formula:
 *   fare = baseFare + (distanceKm × perKm) + (durationMin × perMin)
 *   fare = Math.max(fare, minimumFare)
 *   fare = Math.round(fare)   ← rounded to nearest dollar
 * ============================================================
 */

export const PRICING = {
  chauffeur: {
    // ⬇️ CLIENT TO CONFIRM THESE VALUES
    baseFare: 10,       // flat base charge AUD
    perKm: 3.50,        // per kilometre AUD
    perMin: 0.80,       // per minute AUD
    minimumFare: 80,    // minimum trip fare AUD
    label: 'Chauffeur Service',
  },

  taxi: {
    // ⬇️ CLIENT TO CONFIRM THESE VALUES
    baseFare: 5,        // flat base charge AUD
    perKm: 2.20,        // per kilometre AUD
    perMin: 0.60,       // per minute AUD
    minimumFare: 25,    // minimum trip fare AUD
    label: 'Taxi Service',
  },
};

/**
 * Optional surcharges (set to 0 to disable)
 * ⬇️ CLIENT TO CONFIRM THESE VALUES
 */
export const SURCHARGES = {
  airportSurcharge: 5,     // AUD — added when destination is an airport
  nightSurcharge: 10,      // AUD — added for pickups between 10pm–5am
  weekendSurcharge: 0,     // AUD — added on Saturday/Sunday (0 = disabled)
  tollsEstimate: 0,        // AUD — flat toll estimate (0 = not included)
};

/**
 * Keywords that trigger the airport surcharge
 */
export const AIRPORT_KEYWORDS = [
  'airport', 'terminal', 'kingsford smith', 'syd', 't1', 't2', 't3',
];

/**
 * Night surcharge hours (24h format)
 */
export const NIGHT_HOURS = { start: 22, end: 5 }; // 10pm to 5am

