import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Route } from '../models/route.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from syd-bookings-server root
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function seedFaresFromExcelData() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error(`MONGODB_URI is not defined in ${envPath}`);
    }

    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB successfully.`);

    const jsonPath = path.resolve(__dirname, 'syd_fares_extracted.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Extracted JSON not found at ${jsonPath}`);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const fareItems = JSON.parse(rawData);
    console.log(`Loaded ${fareItems.length} suburbs from Sydney_Fare_List.xlsx.`);

    const bulkOperations = [];
    const seen = new Set();

    for (const item of fareItems) {
      const suburb = item.suburb.trim();
      if (!suburb) continue;

      const pairs = [
        // 1. Sydney CBD <-> Suburb
        {
          first: 'Sydney CBD',
          last: suburb,
          chauffeurFare: item.cityFare || 88,
          taxiFare: Math.round((item.cityFare || 88) * 0.75),
        },
        // 2. Sydney Airport Domestic <-> Suburb
        {
          first: 'Sydney Domestic Airport (T2/T3)',
          last: suburb,
          chauffeurFare: item.domDrop || item.domPickup || 100,
          taxiFare: Math.round((item.domDrop || 100) * 0.75),
        },
        // 3. Suburb -> Sydney Domestic Airport
        {
          first: suburb,
          last: 'Sydney Domestic Airport (T2/T3)',
          chauffeurFare: item.domPickup || item.domDrop || 100,
          taxiFare: Math.round((item.domPickup || 100) * 0.75),
        },
        // 4. Sydney International Airport <-> Suburb
        {
          first: 'Sydney International Airport (T1)',
          last: suburb,
          chauffeurFare: item.intlDrop || item.intlPickup || 110,
          taxiFare: Math.round((item.intlDrop || 110) * 0.75),
        },
        // 5. Suburb -> Sydney International Airport
        {
          first: suburb,
          last: 'Sydney International Airport (T1)',
          chauffeurFare: item.intlPickup || item.intlDrop || 110,
          taxiFare: Math.round((item.intlPickup || 110) * 0.75),
        },
        // 6. Generic Sydney Airport (SYD) <-> Suburb
        {
          first: 'Sydney Airport (SYD)',
          last: suburb,
          chauffeurFare: item.domDrop || item.intlDrop || 100,
          taxiFare: Math.round((item.domDrop || 100) * 0.75),
        },
        {
          first: suburb,
          last: 'Sydney Airport (SYD)',
          chauffeurFare: item.domPickup || item.intlPickup || 100,
          taxiFare: Math.round((item.domPickup || 100) * 0.75),
        },
      ];

      for (const pair of pairs) {
        const key = `${pair.first.toLowerCase()}:::${pair.last.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        bulkOperations.push({
          updateOne: {
            filter: {
              firstPlace: { $regex: new RegExp(`^${pair.first.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
              lastPlace: { $regex: new RegExp(`^${pair.last.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
            },
            update: {
              $set: {
                firstPlace: pair.first,
                lastPlace: pair.last,
                'vehicleAndFares.Chauffeur': pair.chauffeurFare,
                'vehicleAndFares.Taxi': pair.taxiFare,
                currency: 'AUD',
                isActive: true,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                firstPlaceDetails: {
                  address: pair.first,
                  code: pair.first.includes('Airport') ? 'SYD' : 'CBD',
                },
                lastPlaceDetails: {
                  address: pair.last,
                },
                increaseFarePerPerson: {
                  Chauffeur: 10,
                  Taxi: 10,
                },
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        });
      }
    }

    console.log(`Prepared ${bulkOperations.length} upsert operations for MongoDB.`);
    const result = await Route.bulkWrite(bulkOperations);
    console.log('Bulk write completed successfully:');
    console.log(`- Matched: ${result.matchedCount}`);
    console.log(`- Modified: ${result.modifiedCount}`);
    console.log(`- Upserted: ${result.upsertedCount}`);

    const totalRoutes = await Route.countDocuments();
    console.log(`Total Routes in database now: ${totalRoutes}`);
  } catch (error) {
    console.error('Error seeding fares from Excel data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seedFaresFromExcelData();
