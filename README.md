# syd-backend

Modular and clean Express.js REST API for SYD Transport (Internal Bookings & Route Fare Catalog).

## Directory Structure

```text
syd-backend/
├── config/
│   ├── db.js                      # MongoDB connection setup
│   └── stripe.js                  # Stripe SDK configuration
├── controllers/
│   ├── health.controller.js       # Health check controller
│   ├── booking.controller.js      # Booking REST controller
│   ├── route.controller.js        # Route & places REST controller
│   └── payment.controller.js      # Payment & Stripe webhook controller
├── models/
│   ├── admin.model.js             # Admin user schema
│   ├── booking.model.js           # Single Booking schema & indexes
│   ├── payment.model.js           # Payment transaction ledger schema
│   └── route.model.js             # Route fare catalog schema & indexes
├── routes/
│   ├── admin.routes.js            # Admin management routes (bookings, payments, routes)
│   ├── booking.routes.js          # Booking route definitions
│   ├── health.routes.js           # Health route definitions
│   ├── payment.routes.js          # Payment & checkout route definitions
│   ├── route.routes.js            # Route & places route definitions
│   └── index.js                   # API route aggregation
├── services/
│   ├── booking.service.js         # Booking business logic & reference generation
│   ├── payment.service.js         # Stripe payments & checkout logic
│   └── route.service.js           # Route lookups, deduplication & fare seeding
├── middlewares/
│   └── notFound.middleware.js     # 404 Route Not Found middleware
├── errorHandler/
│   └── errorHandler.js            # Centralized error handler
├── index.js                       # Main application entry point
├── .env                           # Environment variables
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Setup & Running

```bash
# Install dependencies
npm install

# Run in development mode (with live reload)
npm run dev

# Run in production
npm start
```

Default Server URL: `http://localhost:5000`

---

## Schema Overview

### 1. Booking Schema Fields

The `Booking` model contains internal booking details:
- `bookingNumber` (e.g. `SYD-K9J4M2`, unique, uppercase, indexed)
- `pickup` (String or Object with coordinates/address)
- `dropoff` (String or Object with coordinates/address)
- `pickupTime` (ISO Date string or Date)
- `passengers` (Number, min 1)
- `vehicleType` (String, e.g. `Sedan`, `SUV`, `Van`)
- `passengerName` (String, required)
- `passengerPhone` (String, required; accepts `passengerPhon` alias)
- `passengerEmail` (String, optional)
- `status` (`pending`, `confirmed`, `assigned`, `on_the_way`, `arrived`, `in_progress`, `completed`, `cancelled`)
- `fare` (Object or Number e.g. `{ currency: "AUD", total: 85.50 }`)
- `paymentStatus` (`pending`, `paid`, `cash_to_driver`, `card`)
- `notes` (String, optional internal or passenger notes)
- `cancellationReason` (String, optional)
- Timestamps (`createdAt`, `updatedAt`)

### 2. Route Schema Fields

The `Route` model represents fixed transfer fares between origin and destination places:
- `firstPlace` (String, required, indexed - e.g. `Sydney Airport (SYD)`)
- `lastPlace` (String, required, indexed - e.g. `Sydney CBD`)
- `vehicleAndFares` (Map of vehicle types to fare numbers, required, e.g. `{ taxi: 65, executive: 85, luxury: 110, suv: 95, van: 125 }`)
- `increaseFarePerPerson` (Map of vehicle types to extra fare per passenger, e.g. `{ taxi: 10, luxury: 15 }`)
- `currency` (String, default: `AUD`, uppercase)
- `distanceKm` (Number, distance in kilometers)
- `durationMin` (Number, estimated duration in minutes)
- `firstPlaceDetails` (Object: `{ address, lat, lng, code }`)
- `lastPlaceDetails` (Object: `{ address, lat, lng, code }`)
- `isActive` (Boolean, default: `true`, indexed)
- `notes` (String, internal remarks)
### 3. Payment Schema Fields

The `Payment` model tracks payment transactions:
- `bookingId` (ObjectId, ref: 'Booking', required, indexed)
- `bookingNumber` (String, required, indexed, uppercase)
- `stripePaymentIntentId` (String, required, indexed)
- `stripeCheckoutSessionId` (String, optional)
- `amount` (Number, required)
- `currency` (String, default: `AUD`, uppercase)
- `status` (`requires_payment_method`, `requires_confirmation`, `requires_action`, `processing`, `succeeded`, `canceled`, `failed`)
- `paymentMethodType` (String, default: `card`)
- `customerEmail` (String)
- `receiptUrl` (String)
- `metadata` (Mixed)
- Timestamps (`createdAt`, `updatedAt`)

### 4. Admin Schema Fields

The `Admin` model represents administrator accounts:
- `name` (String, required)
- `email` (String, required, unique, lowercase, indexed)
- `password` (String, required, `select: false`)
- `role` (`admin`, `superadmin`, default: `admin`)
- `phone` (String)
- `isActive` (Boolean, default: `true`)
- `lastLoginAt` (Date, default: `null`)
- `refreshToken` (String, `select: false`)
- `refreshTokenExpiresAt` (Date, default: `null`)
- Timestamps (`createdAt`, `updatedAt`)

---

## Postman API Testing Guide

All endpoints are served under `http://localhost:5000/api`. Ensure the header is set:
```http
Content-Type: application/json
```

---

## Part A: Health Endpoints

### Health Check

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/health`
- **Response `200 OK`**:
```json
{
  "status": "ok",
  "uptime": 12.34,
  "timestamp": "2026-10-26T15:50:00.000Z"
}
```

---

## Part B: Route & Fare Catalog Endpoints

All route endpoints are accessible under `http://localhost:5000/api/routes` (and `http://localhost:5000/api/places`).

### 1. Seed Default Routes

Seeds standard Sydney transfer routes (Airport to CBD, Bondi Beach, Parramatta, Manly, Chatswood, etc.):

- **Method**: `POST`
- **URL**: `http://localhost:5000/api/routes/seed`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Successfully seeded 7 default route fares",
  "count": 7,
  "routes": [ ... ]
}
```

---

### 2. Lookup Route Fare (Bidirectional & Fuzzy Matching)

Finds the fixed fare between two places. Automatically handles forward, reverse, and fuzzy substring matching.

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/routes/lookup?firstPlace=Sydney Airport&lastPlace=Sydney CBD`
- **Accepted Query Parameters**:
  - `firstPlace` or `from` or `pickup`
  - `lastPlace` or `to` or `destination`
- **Alternative Path URL**: `http://localhost:5000/api/routes/route/Sydney Airport (SYD)/Sydney CBD`
- **Response `200 OK`**:
```json
{
  "success": true,
  "route": {
    "_id": "6adf7e0950aff857923e1338",
    "firstPlace": "Sydney Airport (SYD)",
    "lastPlace": "Sydney CBD",
    "currency": "AUD",
    "distanceKm": 14,
    "durationMin": 25,
    "vehicleAndFares": {
      "taxi": 65,
      "executive": 85,
      "luxury": 110,
      "suv": 95,
      "mpv": 105,
      "van": 125
    },
    "increaseFarePerPerson": {
      "taxi": 10,
      "executive": 10,
      "luxury": 15,
      "suv": 12,
      "mpv": 12,
      "van": 15
    },
    "firstPlaceDetails": {
      "address": "Mascot NSW 2020",
      "lat": -33.9399,
      "lng": 151.1753,
      "code": "SYD"
    },
    "lastPlaceDetails": {
      "address": "Sydney NSW 2000",
      "lat": -33.8688,
      "lng": 151.2093,
      "code": "CBD"
    },
    "isActive": true
  }
}
```

---

### 3. Get All Unique Places (Dropdowns & Autocomplete)

Retrieves a clean, deduplicated list of all available places from registered routes.

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/routes/all`
- **Optional Query Parameters**:
  - `search` or `q`: Filter places by keyword (e.g. `?q=airport`)
  - `details=true`: Include coordinates, address, and place codes
  - `raw=true`: Return raw array of places without JSON wrapper
  - `isActive=true`: Only include active routes
- **Alternative URLs**: `/api/routes/names`, `/api/routes/unique`, `/api/routes/all-places`
- **Response `200 OK` (Standard)**:
```json
{
  "success": true,
  "count": 7,
  "places": [
    "Bondi Beach",
    "Chatswood",
    "Manly",
    "Manly Beach",
    "Parramatta",
    "Sydney Airport (SYD)",
    "Sydney CBD"
  ]
}
```
- **Response `200 OK` (with `?details=true`)**:
```json
{
  "success": true,
  "count": 7,
  "places": [
    {
      "name": "Sydney Airport (SYD)",
      "address": "Mascot NSW 2020",
      "lat": -33.9399,
      "lng": 151.1753,
      "code": "SYD"
    },
    ...
  ]
}
```

---

### 4. Search Places Autocomplete

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/routes/search?q=airport`
- **Response `200 OK`**:
```json
{
  "success": true,
  "count": 1,
  "places": [
    {
      "name": "Sydney Airport (SYD)",
      "address": "Mascot NSW 2020",
      "lat": -33.9399,
      "lng": 151.1753,
      "code": "SYD"
    }
  ]
}
```

---

### 5. Get Connected Destinations for Origin

Returns all destination places connected to a given origin place:

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/routes/destinations?from=Sydney Airport (SYD)`
- **Response `200 OK`**:
```json
{
  "success": true,
  "origin": "Sydney Airport (SYD)",
  "count": 5,
  "places": [
    { "name": "Bondi Beach", "address": "Bondi Beach NSW 2026", "lat": -33.8915, "lng": 151.2767, "code": "" },
    { "name": "Chatswood", "address": "Chatswood NSW 2067", "lat": -33.7961, "lng": 151.178, "code": "" },
    { "name": "Manly", "address": "Manly NSW 2095", "lat": -33.7971, "lng": 151.2882, "code": "" },
    { "name": "Parramatta", "address": "Parramatta NSW 2150", "lat": -33.815, "lng": 151.0011, "code": "" },
    { "name": "Sydney CBD", "address": "Sydney NSW 2000", "lat": -33.8688, "lng": 151.2093, "code": "CBD" }
  ]
}
```

---

### 6. List All Routes (with Pagination & Filters)

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/routes`
- **Optional Query Parameters**:
  - `search`: Search by place name or notes
  - `firstPlace`: Filter by origin
  - `lastPlace`: Filter by destination
  - `isActive`: `true` or `false`
  - `limit`: Number of results (default: `50`)
  - `skip`: Pagination offset (default: `0`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "routes": [ ... ],
  "total": 7,
  "limit": 50,
  "skip": 0
}
```

---

### 7. Create Route Fare

- **Method**: `POST`
- **URL**: `http://localhost:5000/api/routes`
- **Body (raw JSON)**:
```json
{
  "firstPlace": "Sydney Airport (SYD)",
  "lastPlace": "Cronulla Beach",
  "currency": "AUD",
  "distanceKm": 24,
  "durationMin": 30,
  "vehicleAndFares": {
    "taxi": 80,
    "executive": 105,
    "luxury": 135,
    "suv": 115,
    "van": 145
  },
  "increaseFarePerPerson": {
    "taxi": 10,
    "executive": 10,
    "luxury": 15
  },
  "firstPlaceDetails": {
    "address": "Mascot NSW 2020",
    "lat": -33.9399,
    "lng": 151.1753,
    "code": "SYD"
  },
  "lastPlaceDetails": {
    "address": "Cronulla NSW 2230",
    "lat": -34.0574,
    "lng": 151.1522
  },
  "isActive": true,
  "notes": "Sutherland Shire transfer route"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Route fare created successfully",
  "route": { ... }
}
```

---

### 8. Update Route Fare

- **Method**: `PATCH` (or `PUT`)
- **URL**: `http://localhost:5000/api/routes/:id`
- **Body (raw JSON)**:
```json
{
  "vehicleAndFares": {
    "taxi": 70,
    "executive": 90,
    "luxury": 115,
    "suv": 100,
    "van": 130
  },
  "notes": "Updated peak season fares"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Route fare updated successfully",
  "route": { ... }
}
```

---

### 9. Delete Route Fare

- **Method**: `DELETE`
- **URL**: `http://localhost:5000/api/routes/:id`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Route with ID '...' deleted successfully"
}
```

---

## Part C: Booking Endpoints

All booking routes are accessible at `http://localhost:5000/api/bookings`.

### 1. Create Booking

- **Method**: `POST`
- **URL**: `http://localhost:5000/api/bookings`
- **Body (raw JSON)**:
```json
{
  "pickup": "Sydney Airport Terminal 1, Mascot NSW 2020",
  "dropoff": "Circular Quay, Sydney NSW 2000",
  "pickupTime": "2026-10-30T10:00:00.000Z",
  "passengers": 2,
  "vehicleType": "Sedan",
  "passengerName": "John Doe",
  "passengerPhone": "+61412345678",
  "passengerEmail": "john.doe@example.com",
  "status": "confirmed",
  "fare": {
    "currency": "AUD",
    "total": 85.50
  },
  "paymentStatus": "pending",
  "notes": "Flight QF402 arriving at 09:30 AM. Need child booster seat."
}
```

- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Booking confirmed successfully",
  "booking": {
    "id": "671cc15f10b249a518fb9911",
    "bookingNumber": "SYD-K9J4M2",
    "pickup": "Sydney Airport Terminal 1, Mascot NSW 2020",
    "dropoff": "Circular Quay, Sydney NSW 2000",
    "pickupTime": "2026-10-30T10:00:00.000Z",
    "passengers": 2,
    "vehicleType": "Sedan",
    "passengerName": "John Doe",
    "passengerPhone": "+61412345678",
    "passengerPhon": "+61412345678",
    "passengerEmail": "john.doe@example.com",
    "status": "confirmed",
    "fare": {
      "currency": "AUD",
      "total": 85.50
    },
    "paymentStatus": "pending",
    "notes": "Flight QF402 arriving at 09:30 AM. Need child booster seat.",
    "cancellationReason": "",
    "createdAt": "2026-10-26T15:52:00.000Z",
    "updatedAt": "2026-10-26T15:52:00.000Z"
  }
}
```

---

### 2. Get All Bookings (with Pagination & Filters)

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/bookings`
- **Optional Query Parameters**:
  - `phone`: Filter by passenger phone number (e.g. `?phone=0412345678`)
  - `status`: Filter by status (`pending`, `confirmed`, `completed`, `cancelled`, etc.)
  - `vehicleType`: Filter by vehicle type (e.g. `?vehicleType=Sedan`)
  - `bookingNumber`: Filter by booking reference (e.g. `?bookingNumber=SYD-K9J4M2`)
  - `limit`: Number of records to return (default: `50`, max: `100`)
  - `skip`: Pagination offset (default: `0`)

- **Response `200 OK`**:
```json
{
  "success": true,
  "total": 1,
  "bookings": [
    {
      "_id": "671cc15f10b249a518fb9911",
      "bookingNumber": "SYD-K9J4M2",
      "pickup": "Sydney Airport Terminal 1, Mascot NSW 2020",
      "dropoff": "Circular Quay, Sydney NSW 2000",
      "pickupTime": "2026-10-30T10:00:00.000Z",
      "passengers": 2,
      "vehicleType": "Sedan",
      "passengerName": "John Doe",
      "passengerPhone": "+61412345678",
      "passengerEmail": "john.doe@example.com",
      "status": "confirmed",
      "fare": {
        "currency": "AUD",
        "total": 85.50
      },
      "paymentStatus": "pending",
      "notes": "Flight QF402 arriving at 09:30 AM. Need child booster seat.",
      "cancellationReason": "",
      "createdAt": "2026-10-26T15:52:00.000Z",
      "updatedAt": "2026-10-26T15:52:00.000Z"
    }
  ]
}
```

---

### 3. Get Booking By Reference or ID

Supports lookup using either the **bookingNumber** (`SYD-XXXXXX`) or MongoDB **_id**.

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/bookings/SYD-K9J4M2`
- **Response `200 OK`**:
```json
{
  "success": true,
  "booking": {
    "_id": "671cc15f10b249a518fb9911",
    "bookingNumber": "SYD-K9J4M2",
    "pickup": "Sydney Airport Terminal 1, Mascot NSW 2020",
    "dropoff": "Circular Quay, Sydney NSW 2000",
    "pickupTime": "2026-10-30T10:00:00.000Z",
    "passengers": 2,
    "vehicleType": "Sedan",
    "passengerName": "John Doe",
    "passengerPhone": "+61412345678",
    "passengerEmail": "john.doe@example.com",
    "status": "confirmed",
    "fare": {
      "currency": "AUD",
      "total": 85.50
    },
    "paymentStatus": "pending",
    "notes": "Flight QF402 arriving at 09:30 AM. Need child booster seat.",
    "cancellationReason": "",
    "createdAt": "2026-10-26T15:52:00.000Z",
    "updatedAt": "2026-10-26T15:52:00.000Z"
  }
}
```

---

### 4. Update Booking Status / Payment / Notes

- **Method**: `PATCH`
- **URL**: `http://localhost:5000/api/bookings/SYD-K9J4M2/status`
- **Body (raw JSON)**:
```json
{
  "status": "in_progress",
  "paymentStatus": "paid",
  "notes": "Passenger picked up on schedule."
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Booking status updated successfully",
  "booking": {
    "_id": "671cc15f10b249a518fb9911",
    "bookingNumber": "SYD-K9J4M2",
    "status": "in_progress",
    "paymentStatus": "paid",
    "notes": "Passenger picked up on schedule.",
    ...
  }
}
```

---

### 5. Cancel Booking

- **Method**: `POST`
- **URL**: `http://localhost:5000/api/bookings/SYD-K9J4M2/cancel`
- **Body (raw JSON)**:
```json
{
  "reason": "Customer requested cancellation due to flight delay"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "booking": {
    "_id": "671cc15f10b249a518fb9911",
    "bookingNumber": "SYD-K9J4M2",
    "status": "cancelled",
    "cancellationReason": "Customer requested cancellation due to flight delay",
    ...
  }
}
```

---

### 6. Delete Booking

Permanently removes a booking from the database by **bookingNumber** (`SYD-XXXXXX`) or MongoDB **_id**.

- **Method**: `DELETE`
- **URL**: `http://localhost:5000/api/bookings/SYD-K9J4M2`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Booking deleted successfully",
  "booking": { ... }
}
```

---

## Part D: Admin Endpoints

All admin endpoints are accessible under `http://localhost:5000/api/admin`.

### Admin Endpoints Overview

| Category | Method | Endpoint | Description | Access |
|---|---|---|---|---|
| **Auth** | `POST` | `/api/admin/login` | Login with email & password (sets HTTP-only `accessToken` & `refreshToken` cookies) | Public |
| | `POST` | `/api/admin/logout` | Logout (clears cookies and revokes refresh token) | Admin / Superadmin |
| | `GET` | `/api/admin/me` | Get current authenticated admin profile | Admin / Superadmin |
| **Superadmin CRUD** | `GET` | `/api/admin/admins` | List all admin accounts | Superadmin only |
| | `POST` | `/api/admin/admins` | Create new admin or superadmin | Superadmin only |
| | `GET` | `/api/admin/admins/:id` | Get admin by ID | Superadmin only |
| | `PUT` / `PATCH` | `/api/admin/admins/:id` | Update admin info (name, email, role, phone, isActive) | Superadmin only |
| | `POST` / `PATCH` | `/api/admin/admins/:id/set-password` | Set / reset password for an admin | Superadmin only |
| | `DELETE` | `/api/admin/admins/:id` | Delete an admin account | Superadmin only |
| **Bookings** | `GET` | `/api/admin/bookings` | List all bookings with query filters & pagination | Admin / Superadmin |
| | `GET` | `/api/admin/bookings/:refOrId` | Get booking by ID or reference code (`SYD-XXXXXX`) | Admin / Superadmin |
| | `PUT` / `PATCH` | `/api/admin/bookings/:refOrId` | Update full booking details (edit any field) | Admin / Superadmin |
| | `PATCH` | `/api/admin/bookings/:refOrId/status` | Update booking status, payment status, or notes | Admin / Superadmin |
| | `POST` | `/api/admin/bookings/:refOrId/cancel` | Cancel a booking with reason | Admin / Superadmin |
| | `DELETE` | `/api/admin/bookings/:refOrId` | Permanently delete a booking | Admin / Superadmin |
| **Payments** | `GET` | `/api/admin/payments` | List all payment records with filters & pagination | Admin / Superadmin |
| | `GET` | `/api/admin/payments/booking/:refOrId` | Get payment status and transaction history for a booking | Admin / Superadmin |
| **Routes** | `GET` | `/api/admin/routes` | List all routes with filters & pagination | Admin / Superadmin |
| | `POST` | `/api/admin/routes` | Create a new route fare mapping | Admin / Superadmin |
| | `GET` | `/api/admin/routes/:id` | Get route details by ID | Admin / Superadmin |
| | `PUT` / `PATCH` | `/api/admin/routes/:id` | Update route fare / details by ID | Admin / Superadmin |
| | `DELETE` | `/api/admin/routes/:id` | Delete a route by ID | Admin / Superadmin |

---

### Authentication & Token Rotation Workflow

- **Cookies**: Upon successful login, the server sets two HttpOnly cookies:
  - `accessToken`: Short-lived (default `30m` via `ACCESS_TOKEN_VALIDITY`).
  - `refreshToken`: Long-lived (default `7d` via `REFRESH_TOKEN_VALIDITY`).
- **Automatic Rotation**: When a request arrives with an expired `accessToken`, the authentication middleware checks the `refreshToken`. If valid and matching the stored token in DB, it **automatically issues and rotates a new refreshToken** and new `accessToken` directly in the response cookies, allowing seamless uninterrupted requests.
- **Role Enforcement**: Protected routes require a valid session. Superadmin endpoints (`/api/admin/admins/*`) specifically require `role === 'superadmin'`.

---

### 1. Admin Login

- **Method**: `POST`
- **URL**: `http://localhost:5000/api/admin/login`
- **Body (raw JSON)**:
```json
{
  "email": "admin@sydtransport.com.au",
  "password": "yourSecretPassword"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Login successful",
  "admin": {
    "id": "6acf7f098ebdf026739444e8",
    "name": "System Administrator",
    "email": "admin@sydtransport.com.au",
    "role": "admin",
    "phone": "+61 400 000 000",
    "isActive": true,
    "lastLoginAt": "2026-10-28T15:35:00.000Z"
  }
}
```
*(Also sets `accessToken` and `refreshToken` cookies automatically).*

---

### 2. Admin Logout

- **Method**: `POST`
- **URL**: `http://localhost:5000/api/admin/logout`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```
*(Clears `accessToken` and `refreshToken` cookies and invalidates refresh token in DB).*

---

### 3. Superadmin: Admin Management

#### Create Admin
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/admin/admins`
- **Body**:
```json
{
  "name": "Operations Manager",
  "email": "ops@sydtransport.com.au",
  "password": "TemporaryPassword123",
  "role": "admin",
  "phone": "+61 411 222 333",
  "isActive": true
}
```

#### List Admins
- **Method**: `GET`
- **URL**: `http://localhost:5000/api/admin/admins?role=admin&isActive=true`

#### Set / Reset Admin Password
- **Method**: `POST` or `PATCH`
- **URL**: `http://localhost:5000/api/admin/admins/:id/set-password`
- **Body**:
```json
{
  "password": "NewSecurePassword456"
}
```

#### Delete Admin
- **Method**: `DELETE`
- **URL**: `http://localhost:5000/api/admin/admins/:id`

---

### 1. Admin: View & List Bookings

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/admin/bookings?status=confirmed&limit=20`
- **Query Parameters**:
  - `phone`: Filter by passenger phone
  - `status`: `pending`, `confirmed`, `assigned`, `on_the_way`, `arrived`, `in_progress`, `completed`, `cancelled`
  - `vehicleType`: Filter by vehicle type (e.g. `Sedan`, `SUV`)
  - `bookingNumber`: Filter by booking reference code
  - `limit`: Number of items per page (default: `50`, max: `100`)
  - `skip`: Number of items to skip for pagination (default: `0`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "total": 42,
  "bookings": [ ... ]
}
```

---

### 2. Admin: Edit Booking Details

Admins can edit any field of an existing booking.

- **Method**: `PUT` or `PATCH`
- **URL**: `http://localhost:5000/api/admin/bookings/SYD-K9J4M2`
- **Body (raw JSON)**:
```json
{
  "pickup": "Sydney Airport Terminal 2",
  "dropoff": "Hilton Sydney, 488 George St",
  "pickupTime": "2026-10-30T14:30:00.000Z",
  "passengers": 3,
  "vehicleType": "Chauffeur",
  "passengerName": "John Doe",
  "passengerPhone": "+61 400 111 222",
  "status": "confirmed",
  "notes": "VIP client - requested quiet ride"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Booking updated successfully",
  "booking": { ... }
}
```

---

### 3. Admin: View Payments Ledger

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/admin/payments?status=succeeded&limit=20`
- **Query Parameters**:
  - `status`: Filter by payment status (`succeeded`, `requires_payment_method`, `processing`, `failed`, `canceled`)
  - `bookingNumber`: Filter by booking reference code
  - `limit`: Page size limit (default: `50`, max: `100`)
  - `skip`: Pagination offset
- **Response `200 OK`**:
```json
{
  "success": true,
  "total": 15,
  "limit": 20,
  "skip": 0,
  "payments": [
    {
      "_id": "671cc15f10b249a518fb9999",
      "bookingId": { ... },
      "bookingNumber": "SYD-K9J4M2",
      "stripePaymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
      "amount": 85.50,
      "currency": "AUD",
      "status": "succeeded",
      "paymentMethodType": "card",
      "customerEmail": "john.doe@example.com",
      "receiptUrl": "https://pay.stripe.com/receipts/...",
      "createdAt": "2026-10-26T16:00:00.000Z"
    }
  ]
}
```

---

### 4. Admin: View Booking Payment Details

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/admin/payments/booking/SYD-K9J4M2`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "bookingNumber": "SYD-K9J4M2",
    "bookingId": "671cc15f10b249a518fb9911",
    "vehicleType": "Sedan",
    "status": "confirmed",
    "paymentStatus": "paid",
    "fare": { "currency": "AUD", "total": 85.50 },
    "paymentDetails": { ... },
    "payments": [ ... ]
  }
}
```

---

### 5. Admin: Route CRUD Operations

#### Create Route
- **Method**: `POST`
- **URL**: `http://localhost:5000/api/admin/routes`
- **Body**:
```json
{
  "firstPlace": "Sydney Airport (SYD)",
  "lastPlace": "Coogee Beach",
  "vehicleAndFares": {
    "Taxi": 65,
    "Chauffeur": 85
  },
  "increaseFarePerPerson": {
    "Taxi": 10,
    "Chauffeur": 10
  },
  "distanceKm": 12,
  "durationMin": 25,
  "currency": "AUD",
  "isActive": true
}
```

#### Read Route
- **Method**: `GET`
- **URL**: `http://localhost:5000/api/admin/routes/:id`

#### Update Route
- **Method**: `PUT` or `PATCH`
- **URL**: `http://localhost:5000/api/admin/routes/:id`
- **Body**:
```json
{
  "vehicleAndFares": {
    "Taxi": 70,
    "Chauffeur": 90
  },
  "isActive": true
}
```

#### Delete Route
- **Method**: `DELETE`
- **URL**: `http://localhost:5000/api/admin/routes/:id`

