import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Route } from '../models/route.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

async function cleanAndSeedFares() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error(`MONGODB_URI is not defined in ${envPath}`);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    // 1. Completely delete all previous routes
    console.log('Clearing old routes from database...');
    const deleteResult = await Route.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} old routes.`);

    // 2. Load Sydney_Fare_List extracted JSON
    const jsonPath = path.resolve(__dirname, 'syd_fares_extracted.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Extracted JSON not found at ${jsonPath}`);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const fareItems = JSON.parse(rawData);
    console.log(`Loaded ${fareItems.length} official suburbs from Sydney_Fare_List.xlsx.`);

    const routesToInsert = [];
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
        // 2. Sydney Domestic Airport <-> Suburb
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

        routesToInsert.push({
          firstPlace: pair.first,
          lastPlace: pair.last,
          firstPlaceDetails: {
            address: pair.first,
            code: pair.first.includes('Airport') ? 'SYD' : 'CBD',
          },
          lastPlaceDetails: {
            address: pair.last,
          },
          vehicleAndFares: {
            Chauffeur: pair.chauffeurFare,
            Taxi: pair.taxiFare,
          },
          increaseFarePerPerson: {
            Chauffeur: 10,
            Taxi: 10,
          },
          currency: 'AUD',
          isActive: true,
          notes: `Official route from Sydney Fare List: ${pair.first} to ${pair.last}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    console.log(`Inserting ${routesToInsert.length} clean routes into MongoDB...`);
    const inserted = await Route.insertMany(routesToInsert, { ordered: false });
    console.log(`Successfully inserted ${inserted.length} clean routes.`);

    const totalRoutes = await Route.countDocuments();
    console.log(`Total Routes in database now: ${totalRoutes}`);
  } catch (error) {
    console.error('Error clean-seeding routes:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

cleanAndSeedFares();
