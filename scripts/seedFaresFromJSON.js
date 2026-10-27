import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { Route } from '../models/route.model.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedFares() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    const jsonPath = path.resolve(__dirname, '../../sydney_transport_fares_plus30.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Fares JSON file not found at: ${jsonPath}`);
    }

    console.log(`Reading JSON from ${jsonPath}...`);
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const faresData = JSON.parse(rawData);

    console.log(`Found ${faresData.length} fare entries in JSON.`);

    const bulkOperations = [];
    const seenRoutes = new Set();

    const addRoute = (first, last, taxiFare, notes, routeVia) => {
      const key = `${first.toLowerCase()}:::${last.toLowerCase()}`;
      if (seenRoutes.has(key)) return;
      seenRoutes.add(key);

      const baseTaxi = Number(taxiFare) || 60;
      // Chauffeur tiers based on realistic executive chauffeur multipliers
      const executiveFare = Math.round(baseTaxi * 1.25);
      const luxuryFare = Math.round(baseTaxi * 1.55);
      const suvFare = Math.round(baseTaxi * 1.4);
      const mpvFare = Math.round(baseTaxi * 1.45);
      const vanFare = Math.round(baseTaxi * 1.7);

      const routeDoc = {
        firstPlace: first,
        lastPlace: last,
        currency: 'AUD',
        isActive: true,
        vehicleAndFares: {
          taxi: baseTaxi,
          executive: executiveFare,
          luxury: luxuryFare,
          suv: suvFare,
          mpv: mpvFare,
          van: vanFare,
        },
        increaseFarePerPerson: {
          taxi: 10,
          executive: 10,
          luxury: 15,
          suv: 12,
          mpv: 12,
          van: 15,
        },
        firstPlaceDetails: {
          address: `${first}, NSW Australia`,
          code: first.includes('SYD') ? 'SYD' : first.includes('CBD') ? 'CBD' : '',
        },
        lastPlaceDetails: {
          address: `${last}, NSW Australia`,
          code: last.includes('SYD') ? 'SYD' : last.includes('CBD') ? 'CBD' : '',
        },
        notes: routeVia && routeVia !== 'Direct / Standard'
          ? `${notes} (Via: ${routeVia})`
          : notes,
      };

      bulkOperations.push({
        updateOne: {
          filter: { firstPlace: first, lastPlace: last },
          update: { $set: routeDoc },
          upsert: true,
        },
      });
    };

    for (const item of faresData) {
      const suburb = (item.suburb || '').trim();
      if (!suburb) continue;

      const via = (item.route_via || '').trim();

      // 1. Suburb <-> Sydney Airport (SYD) [Domestic & International]
      const domDrop = item.dom_drop_aud || item.dom_pickup_aud;
      const intDrop = item.int_drop_aud || item.int_pickup_aud;

      if (domDrop) {
        addRoute(suburb, 'Sydney Airport (SYD)', domDrop, 'Airport Transfer', via);
        // Also support Domestic terminal naming
        addRoute(suburb, 'Sydney Domestic Airport (T2/T3)', domDrop, 'Domestic Airport Transfer', via);
      }

      if (intDrop) {
        addRoute(suburb, 'Sydney International Airport (T1)', intDrop, 'International Airport Transfer', via);
      }

      // 2. Suburb <-> Sydney CBD
      if (item.city_fare_aud) {
        addRoute(suburb, 'Sydney CBD', item.city_fare_aud, 'City Center Transfer', via);
      }
    }

    console.log(`Generated ${bulkOperations.length} unique route combinations. Executing bulk write...`);

    const batchSize = 500;
    let totalUpserted = 0;
    let totalModified = 0;

    for (let i = 0; i < bulkOperations.length; i += batchSize) {
      const batch = bulkOperations.slice(i, i + batchSize);
      const res = await Route.bulkWrite(batch, { ordered: false });
      totalUpserted += res.upsertedCount || 0;
      totalModified += res.modifiedCount || 0;
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1} (${batch.length} routes)...`);
    }

    console.log(`Seeding complete! Upserted: ${totalUpserted}, Modified: ${totalModified}`);
    const count = await Route.countDocuments();
    console.log(`Total Routes in Database: ${count}`);

    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seedFares();
