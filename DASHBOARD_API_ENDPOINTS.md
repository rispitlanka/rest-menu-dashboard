# Dashboard API Endpoints (MenuScan)

This document is for the **restaurant owner dashboard** (web app).

## Base URL

- `http://localhost:8080/api/v1`

## Auth

Most dashboard endpoints require:

`Authorization: Bearer <accessToken>`

---

## 1) Authentication

### POST `/auth/register`

Create owner account + restaurant.

**Payload**

```json
{
  "name": "Santhosh",
  "email": "owner@example.com",
  "password": "Password@123",
  "restaurantName": "Spice Garden"
}
```

### POST `/auth/login`

Login owner.

**Payload**

```json
{
  "email": "owner@example.com",
  "password": "Password@123"
}
```

### POST `/auth/refresh`

Refresh access token.

**Payload**

```json
{
  "refreshToken": "eyJ..."
}
```

### POST `/auth/forgot-password`

Send reset link (Brevo email).

**Payload**

```json
{
  "email": "owner@example.com"
}
```

### POST `/auth/reset-password`

Reset password with token.

**Payload**

```json
{
  "token": "raw_reset_token_from_email",
  "password": "NewPassword@123"
}
```

---

## 2) Restaurant Profile (Dashboard)

### GET `/restaurants/me`

Get logged-in owner restaurant profile.

**Response (example)**

```json
{
  "success": true,
  "data": {
    "_id": "65f3...",
    "ownerId": "65f2...",
    "name": "Spice Garden",
    "logo": "https://...",
    "address": "Chennai",
    "phone": "+91-9000000000",
    "operatingHours": "9AM-11PM",
    "qrCode": "data:image/png;base64,...",
    "isActive": true,
    "createdAt": "2026-03-23T10:00:00.000Z",
    "updatedAt": "2026-03-23T10:30:00.000Z"
  }
}
```

### PUT `/restaurants/me`

Update restaurant profile.

**Payload**

```json
{
  "name": "Spice Garden 2.0",
  "address": "123 Main Road, Chennai",
  "phone": "+91-9000000000",
  "operatingHours": "9AM-11PM",
  "isActive": true
}
```

### POST `/restaurants/qr/generate`

Regenerate restaurant QR.

**Payload**

```json
{}
```

---

## 3) Category Management

### GET `/categories`

List all categories for current restaurant.

**Response (example)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "cat1",
      "restaurantId": "rest1",
      "name": "Starters",
      "displayOrder": 0,
      "isActive": true
    },
    {
      "_id": "cat2",
      "restaurantId": "rest1",
      "name": "Mains",
      "displayOrder": 1,
      "isActive": true
    }
  ]
}
```

### POST `/categories`

Create category.

**Payload**

```json
{
  "name": "Desserts",
  "isActive": true
}
```

### PUT `/categories/:id`

Update category.

**Payload**

```json
{
  "name": "Main Course",
  "isActive": true
}
```

### PUT `/categories/reorder`

Reorder categories.

**Payload**

```json
{
  "items": [
    { "id": "cat2" },
    { "id": "cat1" },
    { "id": "cat3" }
  ]
}
```

### DELETE `/categories/:id`

Delete category (and linked items in this backend implementation).

**Payload**

```json
{}
```

---

## 4) Menu Item Management

### GET `/items?page=1&limit=20&categoryId=<id>&isAvailable=true`

List owner items (paginated/filterable).

**Response (example)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "item1",
      "restaurantId": "rest1",
      "categoryId": "cat1",
      "name": "Paneer Tikka",
      "description": "Smoky grilled paneer",
      "price": 249,
      "images": ["https://..."],
      "variants": [
        {
          "label": "Size",
          "options": [
            { "name": "Regular", "priceModifier": 0 },
            { "name": "Large", "priceModifier": 40 }
          ]
        }
      ],
      "nutritionalInfo": {
        "calories": 320,
        "protein": 12,
        "carbs": 25,
        "fat": 14
      },
      "allergens": ["dairy"],
      "isAvailable": true,
      "displayOrder": 0
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### GET `/items/:id`

Get one item for owner.

**Response (example)**

```json
{
  "success": true,
  "data": {
    "_id": "item1",
    "restaurantId": "rest1",
    "categoryId": "cat1",
    "name": "Paneer Tikka",
    "description": "Smoky grilled paneer",
    "price": 249,
    "images": ["https://..."],
    "variants": [],
    "nutritionalInfo": {},
    "allergens": [],
    "isAvailable": true,
    "displayOrder": 0
  }
}
```

### POST `/items`

Create item (JSON or multipart with images).

**Payload**

```json
{
  "categoryId": "cat1",
  "name": "Paneer Tikka",
  "description": "Smoky grilled paneer",
  "price": 249,
  "images": [],
  "variants": [
    {
      "label": "Size",
      "options": [
        { "name": "Regular", "priceModifier": 0 },
        { "name": "Large", "priceModifier": 40 }
      ]
    }
  ],
  "nutritionalInfo": {
    "calories": 320,
    "protein": 12,
    "carbs": 25,
    "fat": 14
  },
  "allergens": ["dairy"],
  "isAvailable": true,
  "displayOrder": 0
}
```

**Payload (multipart with images)**

- `multipart/form-data`
- fields:
  - `categoryId` (string)
  - `name` (string)
  - `description` (string)
  - `price` (number)
  - `isAvailable` (boolean)
  - `variants` (JSON string)
  - `nutritionalInfo` (JSON string)
  - `allergens` (JSON string)
  - `images` (file[], up to 5)

### PUT `/items/:id`

Update item (partial supported in current backend).

**Payload (example partial)**

```json
{
  "name": "Paneer Tikka Premium",
  "price": 279,
  "isAvailable": true
}
```

### PATCH `/items/:id/availability`

Quick availability toggle.

**Payload**

```json
{
  "isAvailable": false
}
```

### PUT `/items/reorder`

Reorder items.

**Payload**

```json
{
  "items": [
    { "id": "item3" },
    { "id": "item1" },
    { "id": "item2" }
  ]
}
```

### POST `/items/:id/duplicate`

Duplicate existing item.

**Payload**

```json
{}
```

### DELETE `/items/:id`

Delete item.

**Payload**

```json
{}
```

---

## 5) Image Upload (Cloudinary)

### POST `/items/:id/images`

Upload and attach images directly to a menu item.

**Payload**

- `multipart/form-data`
- field name: `images`
- max files: `5`

**Response (example)**

```json
{
  "success": true,
  "data": {
    "_id": "item1",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/v1/item-a.jpg",
      "https://res.cloudinary.com/demo/image/upload/v1/item-b.jpg"
    ]
  }
}
```

### POST `/restaurants/me/logo`

Upload and set restaurant logo.

**Payload**

- `multipart/form-data`
- field name: `logo`
- max files: `1`

**Response (example)**

```json
{
  "success": true,
  "data": {
    "restaurantId": "rest1",
    "logo": "https://res.cloudinary.com/demo/image/upload/v1/logo.jpg"
  }
}
```

---

## 6) Review Moderation (Dashboard)

### GET `/reviews/restaurant/me`

List all restaurant reviews (owner view).

**Response (example)**

```json
{
  "success": true,
  "data": [
    {
      "_id": "rev1",
      "restaurantId": "rest1",
      "menuItemId": {
        "_id": "item1",
        "name": "Paneer Tikka",
        "description": "Smoky grilled paneer",
        "price": 249,
        "images": ["https://res.cloudinary.com/demo/image/upload/v1/item-a.jpg"],
        "categoryId": "cat1",
        "isAvailable": true
      },
      "customerId": {
        "_id": "cust1",
        "name": "Guest User",
        "deviceId": "device-uuid-123"
      },
      "rating": 5,
      "comment": "Amazing taste!",
      "isFlagged": false,
      "createdAt": "2026-03-23T12:00:00.000Z"
    }
  ]
}
```

### PATCH `/reviews/:id/flag`

Flag/unflag review.

**Payload**

```json
{
  "isFlagged": true
}
```

**Response (example)**

```json
{
  "success": true,
  "data": {
    "_id": "rev1",
    "restaurantId": "rest1",
    "menuItemId": {
      "_id": "item1",
      "name": "Paneer Tikka",
      "price": 249,
      "images": ["https://res.cloudinary.com/demo/image/upload/v1/item-a.jpg"]
    },
    "customerId": {
      "_id": "cust1",
      "name": "Guest User",
      "deviceId": "device-uuid-123"
    },
    "rating": 5,
    "comment": "Amazing taste!",
    "isFlagged": true
  }
}
```

---

## 7) Dashboard Analytics

### GET `/analytics/views`

Menu views grouped by date.

**Response (example)**

```json
{
  "success": true,
  "data": [
    { "_id": { "y": 2026, "m": 3, "d": 23 }, "count": 42 }
  ]
}
```

### GET `/analytics/popular`

Most viewed items.

**Response (example)**

```json
{
  "success": true,
  "data": [
    { "_id": "item1", "views": 120 },
    { "_id": "item2", "views": 98 }
  ]
}
```

### GET `/analytics/ratings`

Ratings summary.

**Response (example)**

```json
{
  "success": true,
  "data": {
    "byItem": [
      { "_id": "item1", "avgRating": 4.6, "totalReviews": 23 }
    ],
    "overall": {
      "avgRating": 4.4,
      "totalReviews": 80
    }
  }
}
```

---

## Status Codes (quick reference)

- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error
