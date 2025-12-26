# API Testing Collection

This document contains sample requests for testing the Comment System API.

## Setup

1. Base URL: `http://localhost:5000/api`
2. Save your JWT token after login/register
3. Use the token in Authorization header: `Bearer YOUR_TOKEN`

## Authentication Endpoints

### 1. Register User

```bash
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "password123"
}
```

### 2. Login User

```bash
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### 3. Get Current User

```bash
GET {{baseUrl}}/auth/me
Authorization: Bearer YOUR_TOKEN
```

## Comment Endpoints

### 1. Get All Comments (First Page, Sorted by Newest)

```bash
GET {{baseUrl}}/comments?page=1&limit=10&sortBy=newest
```

### 2. Get All Comments (Sorted by Most Liked)

```bash
GET {{baseUrl}}/comments?page=1&limit=10&sortBy=mostLiked
```

### 3. Get All Comments (Sorted by Most Disliked)

```bash
GET {{baseUrl}}/comments?page=1&limit=10&sortBy=mostDisliked
```

### 4. Get Replies to a Specific Comment

```bash
GET {{baseUrl}}/comments?parentId=PARENT_COMMENT_ID&page=1&limit=10
```

### 5. Get Single Comment

```bash
GET {{baseUrl}}/comments/COMMENT_ID
```

### 6. Create Top-Level Comment

```bash
POST {{baseUrl}}/comments
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": "This is a top-level comment"
}
```

### 7. Create Reply to Comment

```bash
POST {{baseUrl}}/comments
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": "This is a reply to another comment",
  "parentComment": "PARENT_COMMENT_ID"
}
```

### 8. Update Comment

```bash
PUT {{baseUrl}}/comments/COMMENT_ID
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": "Updated comment content"
}
```

### 9. Delete Comment

```bash
DELETE {{baseUrl}}/comments/COMMENT_ID
Authorization: Bearer YOUR_TOKEN
```

### 10. Like Comment

```bash
POST {{baseUrl}}/comments/COMMENT_ID/like
Authorization: Bearer YOUR_TOKEN
```

### 11. Dislike Comment

```bash
POST {{baseUrl}}/comments/COMMENT_ID/dislike
Authorization: Bearer YOUR_TOKEN
```

## Test Scenarios

### Scenario 1: Complete User Flow

1. Register new user
2. Login to get token
3. Create a comment
4. Like the comment
5. Create a reply to the comment
6. Update the original comment
7. Get all comments with sorting

### Scenario 2: Multiple Users Interaction

1. Register User A and User B
2. User A creates a comment
3. User B likes User A's comment
4. User B replies to User A's comment
5. User A tries to edit User B's comment (should fail)
6. User B deletes their own reply

### Scenario 3: Pagination Testing

1. Create 25 comments
2. Get page 1 (10 items)
3. Get page 2 (10 items)
4. Get page 3 (5 items)
5. Verify total count matches

### Scenario 4: Like/Dislike Logic

1. User likes a comment
2. Verify like count increases
3. User clicks like again
4. Verify like is removed
5. User dislikes the same comment
6. Verify dislike adds and like remains removed

## Expected Error Scenarios

### 1. Unauthorized Access

```bash
POST {{baseUrl}}/comments
Content-Type: application/json

{
  "content": "This should fail"
}
# Expected: 401 Unauthorized
```

### 2. Invalid Comment ID

```bash
GET {{baseUrl}}/comments/invalid-id
# Expected: 404 Not Found or 500 with proper error message
```

### 3. Update Another User's Comment

```bash
PUT {{baseUrl}}/comments/OTHER_USER_COMMENT_ID
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": "Trying to update"
}
# Expected: 403 Forbidden
```

### 4. Validation Errors

```bash
POST {{baseUrl}}/comments
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "content": ""
}
# Expected: 400 Bad Request with validation errors
```

### 5. Duplicate Email Registration

```bash
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "email": "john@example.com",  # Already exists
  "password": "password123"
}
# Expected: 400 Bad Request - Email already exists
```

## WebSocket Testing

### JavaScript Client Example

```javascript
const io = require("socket.io-client");
const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected to WebSocket");

  // Join a specific page
  socket.emit("join-page", "test-page-1");

  // Listen for events
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
});

socket.on("disconnect", () => {
  console.log("Disconnected from WebSocket");
});
```

## Performance Testing

### Load Test Comments Endpoint

```bash
# Using Apache Bench (ab)
ab -n 1000 -c 10 http://localhost:5000/api/comments

# Using curl in a loop
for i in {1..100}; do
  curl http://localhost:5000/api/comments?page=$i&limit=10
done
```

## Notes

- Replace `YOUR_TOKEN` with actual JWT token from login/register
- Replace `COMMENT_ID` with actual comment ObjectId
- Replace `PARENT_COMMENT_ID` with actual parent comment ObjectId
- Ensure MongoDB is running and connected
- Check console logs for real-time WebSocket events
