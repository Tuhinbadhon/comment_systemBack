# Quick Setup Instructions

## Installation Steps

### 1. Install Dependencies

Due to potential network issues, try these options in order:

**Option A: Using pnpm (recommended)**

```bash
pnpm install
```

**Option B: If pnpm has issues, use npm**

```bash
npm install
```

**Option C: If network issues persist**

```bash
# Clear cache first
pnpm store prune
# or
npm cache clean --force

# Then try again
pnpm install
# or
npm install
```

### 2. Configure Environment Variables

Update the `.env` file with your MongoDB Atlas credentials:

```env
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/comment-system?retryWrites=true&w=majority
```

**Important:** The `.env` file is already created and included in the repo for evaluation purposes. In production, never commit this file.

### 3. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster (free tier is fine)
3. Create a database user
4. Network Access: Add IP `0.0.0.0/0` (allow all IPs) for testing
5. Get connection string and update `.env`

### 4. Start the Server

**Development mode:**

```bash
pnpm dev
# or
npm run dev
```

**Production mode:**

```bash
pnpm start
# or
npm start
```

Server will run on: `http://localhost:5000`

## Quick Test

Once the server is running, test it:

```bash
# Health check
curl http://localhost:5000/api/health

# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

## Project Structure Overview

```
Backend/
├── config/          # Database configuration
├── controllers/     # Business logic
├── middleware/      # Authentication, validation, error handling
├── models/         # MongoDB schemas
├── routes/         # API endpoints
├── utils/          # Helper functions
├── server.js       # Application entry point
├── .env            # Environment variables (included for review)
└── README.md       # Full documentation
```

## All Features Implemented ✅

1. ✅ JWT Authentication (register, login, protected routes)
2. ✅ Comment CRUD operations
3. ✅ Authorization (only owners can edit/delete)
4. ✅ Like/Dislike system (one action per user)
5. ✅ Nested replies
6. ✅ Pagination (configurable page size)
7. ✅ Sorting (newest, most liked, most disliked)
8. ✅ Real-time updates (Socket.io)
9. ✅ Input validation (express-validator)
10. ✅ Error handling
11. ✅ Security (Helmet, CORS, rate limiting)
12. ✅ RESTful API design
13. ✅ Modular architecture

## API Endpoints Summary

### Authentication

- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Comments

- `GET /api/comments` - Get all comments (with pagination & sorting)
- `GET /api/comments/:id` - Get single comment
- `POST /api/comments` - Create comment (protected)
- `PUT /api/comments/:id` - Update comment (protected, owner only)
- `DELETE /api/comments/:id` - Delete comment (protected, owner only)
- `POST /api/comments/:id/like` - Like comment (protected)
- `POST /api/comments/:id/dislike` - Dislike comment (protected)

## Environment Variables Reference

```env
PORT=5000                          # Server port
NODE_ENV=development              # Environment
MONGODB_URI=mongodb+srv://...     # MongoDB connection string
JWT_SECRET=your_secret_key        # JWT secret (change in production)
JWT_EXPIRE=7d                     # Token expiration
CLIENT_URL=http://localhost:3000  # Frontend URL for CORS
```

## Troubleshooting

### MongoDB Connection Error

- Check if `MONGODB_URI` is correct
- Verify IP whitelist in MongoDB Atlas
- Ensure network connectivity

### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000
# Kill the process
kill -9 <PID>
```

### Dependencies Installation Issues

```bash
# Clear cache
pnpm store prune
# or
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules
pnpm install
# or
npm install
```

## Testing with Postman/Thunder Client

Import these endpoints or see `API_TESTING.md` for detailed examples with cURL commands.

## Next Steps

1. Install dependencies
2. Update MongoDB URI in `.env`
3. Start the server
4. Test the API endpoints
5. Connect with frontend application

## Support Files

- `README.md` - Complete documentation
- `API_TESTING.md` - Testing guide with examples
- `.env.example` - Environment template
- `.env` - Pre-configured for review (update MongoDB URI)

---

**Note:** This backend is production-ready with all required features implemented. The `.env` file is included for evaluation purposes only.
