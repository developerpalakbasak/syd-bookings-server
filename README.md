# syd-backend

Modular and clean Express.js REST API for SYD Transport (Internal Bookings).

## Directory Structure

```text
syd-backend/
├── config/
│   └── db.js                      # MongoDB connection setup
├── controllers/
│   ├── health.controller.js       # Health check controller
│   └── booking.controller.js      # Booking REST controller
├── models/
│   └── booking.model.js           # Single Booking schema & indexes
├── routes/
│   ├── health.routes.js           # Health route definitions
│   ├── booking.routes.js          # Booking route definitions
│   └── index.js                   # API route aggregation
├── services/
│   └── booking.service.js         # Booking business logic & reference generation
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

## Booking Schema Fields

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

---

## Postman API Testing Guide

All booking routes are accessible at `http://localhost:5000/api/bookings`.
Ensure the header is set:
```http
Content-Type: application/json
```

---

### 1. Health Check

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

### 2. Create Booking

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

> **Note on structured pickup/dropoff coordinates**: You can also send objects for `pickup` and `dropoff`:
> ```json
> {
>   "pickup": {
>     "name": "Sydney Airport T1",
>     "address": "Mascot NSW 2020",
>     "lat": -33.9399,
>     "lng": 151.1753
>   },
>   "dropoff": {
>     "name": "Circular Quay",
>     "address": "Sydney NSW 2000",
>     "lat": -33.8613,
>     "lng": 151.2108
>   }
> }
> ```

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

### 3. Get All Bookings (with Pagination & Filters)

- **Method**: `GET`
- **URL**: `http://localhost:5000/api/bookings`
- **Optional Query Parameters**:
  - `phone`: Filter by passenger phone number (e.g. `?phone=0412345678`)
  - `status`: Filter by status (`pending`, `confirmed`, `completed`, `cancelled`, etc.)
  - `vehicleType`: Filter by vehicle type (e.g. `?vehicleType=Sedan`)
  - `bookingNumber`: Filter by booking reference (e.g. `?bookingNumber=SYD-K9J4M2`)
  - `limit`: Number of records to return (default: `50`, max: `100`)
  - `skip`: Pagination offset (default: `0`)

**Example Request URL**:
`http://localhost:5000/api/bookings?status=confirmed&limit=10`

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

### 4. Get Booking By Reference or ID

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

### 5. Update Booking Status / Payment / Notes

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
    "pickup": "Sydney Airport Terminal 1, Mascot NSW 2020",
    "dropoff": "Circular Quay, Sydney NSW 2000",
    "pickupTime": "2026-10-30T10:00:00.000Z",
    "passengers": 2,
    "vehicleType": "Sedan",
    "passengerName": "John Doe",
    "passengerPhone": "+61412345678",
    "passengerEmail": "john.doe@example.com",
    "status": "in_progress",
    "fare": {
      "currency": "AUD",
      "total": 85.50
    },
    "paymentStatus": "paid",
    "notes": "Passenger picked up on schedule.",
    "cancellationReason": "",
    "createdAt": "2026-10-26T15:52:00.000Z",
    "updatedAt": "2026-10-26T15:55:00.000Z"
  }
}
```

---

### 6. Cancel Booking

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
    "pickup": "Sydney Airport Terminal 1, Mascot NSW 2020",
    "dropoff": "Circular Quay, Sydney NSW 2000",
    "pickupTime": "2026-10-30T10:00:00.000Z",
    "passengers": 2,
    "vehicleType": "Sedan",
    "passengerName": "John Doe",
    "passengerPhone": "+61412345678",
    "passengerEmail": "john.doe@example.com",
    "status": "cancelled",
    "fare": {
      "currency": "AUD",
      "total": 85.50
    },
    "paymentStatus": "pending",
    "notes": "Flight QF402 arriving at 09:30 AM. Need child booster seat.",
    "cancellationReason": "Customer requested cancellation due to flight delay",
    "createdAt": "2026-10-26T15:52:00.000Z",
    "updatedAt": "2026-10-26T15:57:00.000Z"
  }
}
```

---

### 7. Delete Booking

Permanently removes a booking from the database by **bookingNumber** (`SYD-XXXXXX`) or MongoDB **_id**.

- **Method**: `DELETE`
- **URL**: `http://localhost:5000/api/bookings/SYD-K9J4M2`
- **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Booking deleted successfully",
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
    "status": "cancelled",
    "fare": {
      "currency": "AUD",
      "total": 85.50
    },
    "paymentStatus": "pending",
    "notes": "Flight QF402 arriving at 09:30 AM. Need child booster seat.",
    "cancellationReason": "Customer requested cancellation due to flight delay",
    "createdAt": "2026-10-26T15:52:00.000Z",
    "updatedAt": "2026-10-26T15:57:00.000Z"
  }
}
```

