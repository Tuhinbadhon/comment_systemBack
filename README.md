# Comment System Backend

A concise, production-ready REST API for comments built with Node.js, Express, MongoDB, and JWT authentication. Supports authentication, comment CRUD, likes/dislikes, nested replies, pagination, sorting, and realtime updates (Pusher recommended for production).

## Features

- Authentication (JWT), comment CRUD, likes/dislikes, replies, pagination, sorting
- Realtime: **Pusher Channels** preferred for production (Socket.io for local/dev)
- Validation, centralized error handling, and security middleware (helmet, CORS, rate-limiting)

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JSON Web Tokens (JWT)** - Authentication
- **bcryptjs** - Password hashing
- **Socket.io** - Real-time communication
- **express-validator** - Request validation
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing
- **express-rate-limit** - Rate limiting
- **morgan** - HTTP request logger
- **dotenv** - Environment variable management

## Quick setup

1. Clone & install

```bash
git clone <repo>
cd Backend
pnpm install
```

2. Configure env

```bash
cp .env.example .env
# set MONGODB_URI, JWT_SECRET, CLIENT_URL, PUSHER_* etc.
```

3. Run

```bash
pnpm dev
```

## Running the Application

### Development Mode (with auto-restart)

```bash
pnpm dev
# or
npm run dev
```

### Production Mode

```bash
pnpm start
# or
npm start
```

The server will start on `http://localhost:5000` (or the PORT specified in your `.env` file).

## API Documentation

### Base URL

```
http://localhost:5000/api
```

### Authentication Endpoints

#### 1. Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  }
}
```

#### 2. Login User

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "username": "johndoe",
      "email": "john@example.com",
      "createdAt": "2025-12-26T10:00:00.000Z"
    }
  }
}
```

#### 3. Get Current User

```http
GET /api/auth/me
Authorization: Bearer {jwt_token}
```

### Comment Endpoints

#### 1. Get All Comments (with pagination and sorting)

```http
GET /api/comments?page=1&limit=10&sortBy=newest&parentId=null
```

**Query Parameters:**

- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10, max: 100) - Items per page
- `sortBy` (optional, default: newest) - Sort option: `newest`, `mostLiked`, `mostDisliked`
- `filter` (optional) - Filter results to comments with activity: `liked` (only comments with ≥1 like) or `disliked` (only comments with ≥1 dislike). You can combine with `sortBy`, e.g. `?filter=liked&sortBy=mostLiked`.
- `parentId` (optional, default: null) - Filter by parent comment ID (for replies)

**Response:**

```json
{
  "success": true,
  "count": 10,
  "total": 50,
  "page": 1,
  "pages": 5,
  "data": [
```

#### Quick cURL examples

- Get most liked (only comments with likes):

```bash
curl "http://localhost:5000/api/comments?sortBy=mostLiked&filter=liked"
```

- Get replies for a comment (paginated):

```bash
curl "http://localhost:5000/api/comments?parentId=<PARENT_ID>&page=1&limit=20"
```

- Post a reply (authorized):

```bash
curl -X POST "http://localhost:5000/api/comments/<PARENT_ID>/reply" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content":"This is a reply"}'
```

- Like a comment:

```bash
curl -X POST "http://localhost:5000/api/comments/<COMMENT_ID>/like" -H "Authorization: Bearer <TOKEN>"
```

    {
      "_id": "comment_id",
      "content": "This is a comment",
      "author": {
        "_id": "user_id",
        "name": "johndoe",
        "email": "john@example.com"
      },
      "parentComment": null,
      "likeCount": 10,
      "dislikeCount": 2,
      "replyCount": 3,
      "isEdited": false,
      "createdAt": "2025-12-26T10:00:00.000Z",
      "updatedAt": "2025-12-26T10:00:00.000Z",
      "isLikedByUser": false,
      "isDislikedByUser": false,
      "isAuthor": false
    }

]
}

````

#### 2. Get Single Comment

```http
GET /api/comments/:id
````

#### 3. Create Comment

```http
POST /api/comments
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "content": "This is my comment",
  "parentComment": null
}
```

**For Replies:**

```json
{
  "content": "This is a reply",
  "parentComment": "parent_comment_id"
}
```

#### 4. Update Comment

```http
PUT /api/comments/:id
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "content": "Updated comment content"
}
```

**Note:** Only the comment author can update their comment.

#### 5. Delete Comment

```http
DELETE /api/comments/:id
Authorization: Bearer {jwt_token}
```

**Note:** Only the comment author can delete their comment. Deleting a comment also deletes all its replies.

#### 6. Like Comment

```http
POST /api/comments/:id/like
Authorization: Bearer {jwt_token}
```

**Note:** Clicking like again removes the like. Liking a comment automatically removes dislike if present.

#### 7. Dislike Comment

```http
POST /api/comments/:id/dislike
Authorization: Bearer {jwt_token}
```

**Note:** Clicking dislike again removes the dislike. Disliking a comment automatically removes like if present.

### Health Check

```http
GET /api/health
```

## WebSocket Events

The backend emits the following Socket.io events for real-time updates:

### Events Emitted by Server

1. **comment:created**

   ```javascript
   {
     comment: { /* comment object */ },
     parentComment: "parent_id" // or null
   }
   ```

2. **comment:updated**

   ```javascript
   {
     comment: {
       /* updated comment object */
     }
   }
   ```

3. **comment:deleted**

   ```javascript
   {
     commentId: "comment_id";
   }
   ```

4. **comment:liked**

   ```javascript
   {
     commentId: "comment_id",
     likeCount: 10,
     dislikeCount: 2
   }
   ```

5. **comment:disliked**
   ```javascript
   {
     commentId: "comment_id",
     likeCount: 10,
     dislikeCount: 2
   }
   ```

### Client-Side Socket Events

Connect to the WebSocket server:

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000");

// Join a specific page/room
socket.emit("join-page", "page-id");

// Listen for comment events
socket.on("comment:created", (data) => {
  console.log("New comment:", data);
});

socket.on("comment:updated", (data) => {
  console.log("Comment updated:", data);
});

socket.on("comment:deleted", (data) => {
  console.log("Comment deleted:", data);
});

socket.on("comment:liked", (data) => {
  console.log("Comment liked:", data);
});

socket.on("comment:disliked", (data) => {
  console.log("Comment disliked:", data);
});

// Leave page
socket.emit("leave-page", "page-id");
```

---

## Pusher (Channels) Integration 🔔

For production-ready realtime updates we use **Pusher Channels** instead of relying on Socket.io in serverless environments.

- Environment variables to set (both locally and in Vercel):

  - `PUSHER_APP_ID`
  - `PUSHER_KEY`
  - `PUSHER_SECRET`
  - `PUSHER_CLUSTER`

- Test:

  - HTTP test: `GET /api/pusher/test`
  - CLI: `node scripts/pusher-trigger.js`

- Client (React) example:

```javascript
import Pusher from "pusher-js";
const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY, {
  cluster: process.env.REACT_APP_PUSHER_CLUSTER,
});
const channel = pusher.subscribe("comments");
channel.bind("comment:reply", ({ reply, parentCommentId }) => {
  /* handle */
});
```

channel.bind("comment:created", (data) => {
console.log("New comment (Pusher):", data);
});

```

- Note: Use the Pusher dashboard to get the correct cluster (Singapore/ap1 is recommended for Bangladesh users).

- Event to listen for replies: `comment:reply` with payload `{ reply, parentCommentId }`.

---

## Deployment & Troubleshooting

### Vercel deployment notes

- Vercel runs serverless functions — persistent WebSocket servers (Socket.io) are not supported. Use **Pusher Channels** for realtime updates on Vercel.
- Add all secrets in Vercel dashboard under Project > Settings > Environment Variables (`MONGODB_URI`, `JWT_SECRET`, `PUSHER_*`, `CLIENT_URL`, etc.).
- Build & Install: ensure Install Command is `pnpm install` (or use default) and leave Build Command empty for this Node serverless setup.

### MongoDB Atlas

- If you see connection errors on Vercel, add `0.0.0.0/0` to Atlas Network Access (or whitelist the relevant IP range). Keep strong credentials.

### Troubleshooting FAQ

- Q: I get CORS errors on live
  - A: Set `CLIENT_URL` in environment variables and ensure it's included in your CORS allowed origins. We accept `.vercel.app` domains by default.
- Q: Serverless function returns 500 on Vercel
  - A: Check Vercel function logs for stack traces; common causes: missing env vars, MongoDB not accessible, or code using `http.createServer()`/Socket.io. Use Pusher for realtime.
- Q: Pusher events not received on the client
  - A: Confirm `REACT_APP_PUSHER_KEY` and `REACT_APP_PUSHER_CLUSTER` are set in frontend env; ensure you use the correct cluster and channel name (`comments`).
- Q: Sorting by likes/dislikes returns all data
  - A: `/api/comments?sortBy=mostLiked` now also filters to only comments with likes (unless you pass an explicit `filter` param).

---

## Project Structure

```

Backend/
├── config/ # Configuration (db, pusher)
├── controllers/ # Express controllers
├── middleware/ # Middleware (auth, validate, error handler)
├── models/ # Mongoose models
├── routes/ # Express routes
├── services/ # Business logic (moved out of controllers)
├── scripts/ # Helper scripts (pusher-trigger, ping clusters)
├── utils/ # Utility helpers
├── tests/ # (optional) tests and scripts

```│ └── commentRoutes.js     # Comment routes
├── utils/
│   └── generateToken.js     # JWT token generation utility
├── .env                     # Environment variables (not in repo)
├── .env.example             # Environment variables template
├── .gitignore              # Git ignore file
├── package.json            # Project dependencies
├── server.js               # Application entry point
└── README.md               # This file
```

## Security Features

1. **JWT Authentication** - Secure token-based authentication
2. **Password Hashing** - bcryptjs with salt rounds
3. **Helmet** - Sets various HTTP headers for security
4. **CORS** - Configured for specific origins
5. **Rate Limiting** - 100 requests per 15 minutes per IP
6. **Input Validation** - express-validator for all inputs
7. **Authorization Checks** - Users can only modify their own content

## Validation Rules

### User Registration

- Username: 3-30 characters
- Email: Valid email format
- Password: Minimum 6 characters

### Comments

- Content: 1-1000 characters, required
- Parent comment: Valid MongoDB ObjectId (optional)

### Query Parameters

- Page: Positive integer
- Limit: 1-100
- SortBy: 'newest', 'mostLiked', or 'mostDisliked'

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error message here",
  "errors": [] // Optional validation errors array
}
```

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not authorized)
- `404` - Not Found
- `500` - Internal Server Error

## Database Schema

### User Model

```javascript
{
  username: String (3-30 chars, unique),
  email: String (unique, validated),
  password: String (hashed, min 6 chars),
  createdAt: Date
}
```

### Comment Model

```javascript
{
  content: String (1-1000 chars),
  author: ObjectId (ref: User),
  parentComment: ObjectId (ref: Comment, optional),
  likes: [ObjectId] (ref: User),
  dislikes: [ObjectId] (ref: User),
  replies: [ObjectId] (ref: Comment),
  isEdited: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Testing the API

You can test the API using:

1. **Postman** - Import the endpoints and test
2. **cURL** - Command line testing
3. **Thunder Client** (VS Code extension)

### Example cURL commands:

```bash
# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get comments
curl http://localhost:5000/api/comments?page=1&limit=10&sortBy=newest

# Create comment (replace YOUR_TOKEN)
curl -X POST http://localhost:5000/api/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content":"This is a test comment"}'
```

## Environment Variables Reference

| Variable      | Description               | Example                       |
| ------------- | ------------------------- | ----------------------------- |
| `PORT`        | Server port               | `5000`                        |
| `NODE_ENV`    | Environment               | `development` or `production` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...`           |
| `JWT_SECRET`  | Secret key for JWT        | Random string                 |
| `JWT_EXPIRE`  | Token expiration time     | `7d`                          |
| `CLIENT_URL`  | Frontend URL for CORS     | `http://localhost:3000`       |

## Deployment

### Prerequisites for Deployment

1. MongoDB Atlas cluster configured
2. Environment variables configured on hosting platform
3. Node.js environment

### Recommended Hosting Platforms

- **Heroku** - Easy deployment with Git
- **Railway** - Modern platform with good free tier
- **Render** - Simple deployment process
- **DigitalOcean** - More control with App Platform
- **AWS/Azure/GCP** - Enterprise solutions

### Important Notes for Production

1. Change `JWT_SECRET` to a strong random string
2. Set `NODE_ENV=production`
3. Configure MongoDB Atlas to allow only specific IPs (not 0.0.0.0/0)
4. Use environment-specific CORS settings
5. Enable HTTPS
6. Set up proper logging and monitoring
7. Configure backup strategies for database

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Common Issues and Solutions

### MongoDB Connection Issues

- Ensure your IP is whitelisted in MongoDB Atlas
- Check if connection string is correct
- Verify network connectivity

### JWT Token Errors

- Make sure to include "Bearer " prefix in Authorization header
- Check if token has expired
- Verify JWT_SECRET matches between token generation and verification

### CORS Errors

- Update `CLIENT_URL` in `.env` to match your frontend URL
- Ensure credentials are properly configured

## Performance Optimization Tips

1. **Indexing** - The Comment model includes indexes on frequently queried fields
2. **Pagination** - Always use pagination for large datasets
3. **Aggregation** - Uses MongoDB aggregation for efficient sorting by counts
4. **Connection Pooling** - Mongoose handles connection pooling automatically
5. **Rate Limiting** - Prevents abuse and reduces server load

## License

ISC

## Support

For questions or issues, please open an issue in the repository or contact the development team.

## Acknowledgments

- MERN Stack Community
- MongoDB Documentation
- Express.js Documentation
- Socket.io Documentation

---

**Note:** This is a demonstration project for a technical assessment. Ensure you update all security credentials and configurations before using in production.

# comment_systemBack
