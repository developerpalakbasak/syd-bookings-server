import {
  PRICING,
  SURCHARGES,
  AIRPORT_KEYWORDS,
  NIGHT_HOURS,
} from '../config/pricing.js';

const ORS_BASE = 'https://api.openrouteservice.org/v2';
const ORS_API_KEY = process.env.ORS_API_KEY || ''; // Free key from openrouteservice.org

/**
 * GET /api/fare/calculate
 * Query params: fromLat, fromLng, toLat, toLng, vehicle, pickupTime (ISO string optional)
 *
 * Returns: { distanceKm, durationMin, fare, breakdown, vehicle, currency }
 */
export const calculateFare = async (req, res, next) => {
  try {
    const {
      fromLat,
      fromLng,
      toLat,
      toLng,
      vehicle = 'chauffeur',
      pickupTime,
      toName = '',
    } = req.query;

    // Validate coords
    const coords = [fromLat, fromLng, toLat, toLng].map(Number);
    if (coords.some((c) => isNaN(c))) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid coordinates. Provide fromLat, fromLng, toLat, toLng.',
      });
    }

    const [fLat, fLng, tLat, tLng] = coords;

    // --- 1. Get distance & duration from OpenRouteService (free, no key for basic) ---
    // We use the public directions API (driving-car profile)
    const orsUrl = `${ORS_BASE}/directions/driving-car?api_key=${ORS_API_KEY}&start=${fLng},${fLat}&end=${tLng},${tLat}`;

    let distanceKm = 0;
    let durationMin = 0;

    try {
      const orsRes = await fetch(orsUrl, {
        headers: { Accept: 'application/json, application/geo+json' },
      });

      if (!orsRes.ok) {
        throw new Error(`ORS responded with status ${orsRes.status}`);
      }

      const orsData = await orsRes.json();
      const segment = orsData?.features?.[0]?.properties?.segments?.[0];

      if (!segment) throw new Error('No route segment returned from ORS');

      distanceKm = parseFloat((segment.distance / 1000).toFixed(2)); // metres → km
      durationMin = parseFloat((segment.duration / 60).toFixed(1));  // seconds → min
    } catch (orsError) {
      console.warn('[Fare] ORS routing failed, falling back to straight-line estimate:', orsError.message);

      // Haversine fallback (straight-line × 1.35 road factor)
      const R = 6371;
      const dLat = ((tLat - fLat) * Math.PI) / 180;
      const dLon = ((tLng - fLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((fLat * Math.PI) / 180) *
          Math.cos((tLat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distanceKm = parseFloat((straight * 1.35).toFixed(2));
      durationMin = parseFloat(((distanceKm / 50) * 60).toFixed(1)); // assume 50 km/h avg
    }

    // --- 2. Apply pricing formula ---
    const vehicleKey = vehicle.toLowerCase().includes('chauffeur') ? 'chauffeur' : 'taxi';
    const rates = PRICING[vehicleKey] || PRICING.chauffeur;

    let baseFare = rates.baseFare;
    let distanceCost = distanceKm * rates.perKm;
    let timeCost = durationMin * rates.perMin;
    let subtotal = baseFare + distanceCost + timeCost;

    // --- 3. Apply surcharges ---
    let airportSurcharge = 0;
    let nightSurcharge = 0;

    // Airport surcharge
    const destinationLower = toName.toLowerCase();
    if (AIRPORT_KEYWORDS.some((kw) => destinationLower.includes(kw))) {
      airportSurcharge = SURCHARGES.airportSurcharge;
    }

    // Night surcharge
    if (pickupTime) {
      const hour = new Date(pickupTime).getHours();
      const { start, end } = NIGHT_HOURS;
      if (hour >= start || hour < end) {
        nightSurcharge = SURCHARGES.nightSurcharge;
      }
    }

    let total = subtotal + airportSurcharge + nightSurcharge + SURCHARGES.tollsEstimate;

    // Apply minimum fare
    total = Math.max(total, rates.minimumFare);

    // Round to nearest dollar
    total = Math.round(total);

    return res.status(200).json({
      success: true,
      distanceKm,
      durationMin,
      fare: total,
      currency: 'AUD',
      vehicle: vehicleKey,
      vehicleLabel: rates.label,
      breakdown: {
        baseFare,
        distanceCost: parseFloat(distanceCost.toFixed(2)),
        timeCost: parseFloat(timeCost.toFixed(2)),
        airportSurcharge,
        nightSurcharge,
        tollsEstimate: SURCHARGES.tollsEstimate,
        minimumFareApplied: subtotal + airportSurcharge + nightSurcharge < rates.minimumFare,
        minimumFare: rates.minimumFare,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

