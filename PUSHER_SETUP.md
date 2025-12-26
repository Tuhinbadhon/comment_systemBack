# Pusher Integration Guide

## Backend Setup (Already Done ✅)

1. **Installed Pusher**: `pnpm add pusher`
2. **Created Pusher config**: `config/pusher.js`
3. **Updated comment controller** to trigger Pusher events

## Environment Variables

Add these to your `.env` file and **Vercel environment variables**:

```env
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=your_cluster
```

### Get Pusher Credentials:

1. Go to [https://dashboard.pusher.com](https://dashboard.pusher.com)
2. Sign up/login (free tier available)
3. Create a new app
4. Go to "App Keys" tab
5. Copy: app_id, key, secret, cluster

## Frontend Setup

### 1. Install Pusher Client

```bash
npm install pusher-js
# or
yarn add pusher-js
# or
pnpm add pusher-js
```

### 2. Create Pusher Client (React Example)

Create `src/lib/pusher.js`:

```javascript
import Pusher from "pusher-js";

const pusher = new Pusher(process.env.REACT_APP_PUSHER_KEY, {
  cluster: process.env.REACT_APP_PUSHER_CLUSTER,
});

export default pusher;
```

Add to `.env`:

```env
REACT_APP_PUSHER_KEY=your_pusher_key
REACT_APP_PUSHER_CLUSTER=your_pusher_cluster
```

### 3. Subscribe to Events

```javascript
import { useEffect } from "react";
import pusher from "./lib/pusher";

function CommentSection() {
  const [comments, setComments] = useState([]);

  useEffect(() => {
    // Subscribe to the comments channel
    const channel = pusher.subscribe("comments");

    // Listen for new comments
    channel.bind("comment:created", (data) => {
      console.log("New comment:", data);
      setComments((prev) => [data.comment, ...prev]);
    });

    // Listen for updated comments
    channel.bind("comment:updated", (data) => {
      console.log("Comment updated:", data);
      setComments((prev) =>
        prev.map((c) => (c._id === data.comment._id ? data.comment : c))
      );
    });

    // Listen for deleted comments
    channel.bind("comment:deleted", (data) => {
      console.log("Comment deleted:", data);
      setComments((prev) => prev.filter((c) => c._id !== data.commentId));
    });

    // Listen for likes
    channel.bind("comment:liked", (data) => {
      console.log("Comment liked:", data);
      setComments((prev) =>
        prev.map((c) =>
          c._id === data.commentId
            ? {
                ...c,
                likeCount: data.likeCount,
                dislikeCount: data.dislikeCount,
              }
            : c
        )
      );
    });

    // Listen for dislikes
    channel.bind("comment:disliked", (data) => {
      console.log("Comment disliked:", data);
      setComments((prev) =>
        prev.map((c) =>
          c._id === data.commentId
            ? {
                ...c,
                likeCount: data.likeCount,
                dislikeCount: data.dislikeCount,
              }
            : c
        )
      );
    });

    // Cleanup on unmount
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, []);

  return (
    <div>
      {comments.map((comment) => (
        <CommentItem key={comment._id} comment={comment} />
      ))}
    </div>
  );
}
```

## Events Reference

| Event              | Trigger                     | Data                                     |
| ------------------ | --------------------------- | ---------------------------------------- |
| `comment:created`  | New comment posted          | `{ comment, parentComment }`             |
| `comment:updated`  | Comment edited              | `{ comment }`                            |
| `comment:deleted`  | Comment deleted             | `{ commentId }`                          |
| `comment:liked`    | Comment liked/unliked       | `{ commentId, likeCount, dislikeCount }` |
| `comment:disliked` | Comment disliked/undisliked | `{ commentId, likeCount, dislikeCount }` |

## Testing

1. Open your app in two browser windows
2. Add a comment in one window
3. See it appear instantly in the other window! 🚀

## Free Tier Limits

- 200,000 messages/day
- 100 concurrent connections
- Unlimited channels

Perfect for development and small-to-medium production apps!
