const Comment = require("../models/Comment");
const pusher = require("../config/pusher");

// Helper: build match stage from parentId and filter
const buildMatchStage = (parentId, filter, sortBy) => {
  const matchStage = { parentComment: parentId };

  if (filter === "liked") {
    matchStage.$expr = { $gt: [{ $size: "$likes" }, 0] };
  } else if (filter === "disliked") {
    matchStage.$expr = { $gt: [{ $size: "$dislikes" }, 0] };
  }

  // If sort implies filtering (backwards compatibility)
  const sb = (sortBy || "").toLowerCase();
  if (!filter) {
    if (sb === "mostliked" || sb === "most-liked") {
      matchStage.$expr = { $gt: [{ $size: "$likes" }, 0] };
    }
    if (sb === "mostdisliked" || sb === "most-disliked") {
      matchStage.$expr = { $gt: [{ $size: "$dislikes" }, 0] };
    }
  }

  return matchStage;
};

// Get comments (aggregation + pagination)
const getComments = async ({
  page = 1,
  limit = 10,
  sortBy = "newest",
  parentId = null,
  filter = "",
}) => {
  const skip = (page - 1) * limit;
  const matchStage = buildMatchStage(parentId, filter, sortBy);

  // select sort
  let sort = { createdAt: -1 };
  const sortByLower = (sortBy || "").toLowerCase();
  switch (sortByLower) {
    case "mostliked":
    case "most-liked":
      sort = { likeCount: -1, createdAt: -1 };
      break;
    case "mostdisliked":
    case "most-disliked":
      sort = { dislikeCount: -1, createdAt: -1 };
      break;
    case "oldest":
      sort = { createdAt: 1 };
      break;
    case "newest":
    default:
      sort = { createdAt: -1 };
      break;
  }

  // aggregation
  const comments = await Comment.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        likeCount: { $size: "$likes" },
        dislikeCount: { $size: "$dislikes" },
        replyCount: { $size: "$replies" },
      },
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
      },
    },
    { $unwind: "$author" },
    {
      $lookup: {
        from: "comments",
        localField: "replies",
        foreignField: "_id",
        as: "replies",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "replies.author",
        foreignField: "_id",
        as: "replyAuthors",
      },
    },
    {
      $addFields: {
        replies: {
          $map: {
            input: "$replies",
            as: "reply",
            in: {
              _id: "$$reply._id",
              content: "$$reply.content",
              author: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$replyAuthors",
                      as: "author",
                      cond: { $eq: ["$$author._id", "$$reply.author"] },
                    },
                  },
                  0,
                ],
              },
              likes: "$$reply.likes",
              dislikes: "$$reply.dislikes",
              likeCount: { $size: "$$reply.likes" },
              dislikeCount: { $size: "$$reply.dislikes" },
              isEdited: "$$reply.isEdited",
              createdAt: "$$reply.createdAt",
              updatedAt: "$$reply.updatedAt",
            },
          },
        },
      },
    },
    {
      $project: {
        content: 1,
        author: { _id: 1, name: 1, email: 1 },
        parentComment: 1,
        likes: 1,
        dislikes: 1,
        replies: 1,
        likeCount: 1,
        dislikeCount: 1,
        replyCount: 1,
        isEdited: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  const total = await Comment.countDocuments(matchStage);
  return { comments, total };
};

// Get single comment by id
const getCommentById = async (id) => {
  const comment = await Comment.findById(id)
    .populate("author", "name email")
    .populate({
      path: "replies",
      populate: { path: "author", select: "name email" },
    });
  return comment;
};

// Create comment
const createComment = async ({ content, parentComment, userId }) => {
  if (parentComment) {
    const parentExists = await Comment.findById(parentComment);
    if (!parentExists) throw new Error("Parent comment not found");
  }

  const comment = await Comment.create({
    content,
    author: userId,
    parentComment: parentComment || null,
  });

  if (parentComment) {
    await Comment.findByIdAndUpdate(parentComment, {
      $push: { replies: comment._id },
    });
  }

  await comment.populate("author", "name email");

  try {
    await pusher.trigger("comments", "comment:created", {
      comment: comment.toObject(),
      parentComment,
    });
  } catch (err) {
    console.error("Pusher error:", err);
  }

  return comment;
};

// Update comment
const updateComment = async ({ id, content, userId }) => {
  let comment = await Comment.findById(id);
  if (!comment) throw new Error("Comment not found");
  if (comment.author.toString() !== userId) throw new Error("Not authorized");

  comment = await Comment.findByIdAndUpdate(
    id,
    { content, isEdited: true, updatedAt: Date.now() },
    { new: true, runValidators: true }
  ).populate("author", "name email");

  try {
    await pusher.trigger("comments", "comment:updated", {
      comment: comment.toObject(),
    });
  } catch (err) {
    console.error("Pusher error:", err);
  }

  return comment;
};

// Delete comment
const deleteComment = async ({ id, userId }) => {
  const comment = await Comment.findById(id);
  if (!comment) throw new Error("Comment not found");
  if (comment.author.toString() !== userId) throw new Error("Not authorized");

  if (comment.parentComment) {
    await Comment.findByIdAndUpdate(comment.parentComment, {
      $pull: { replies: comment._id },
    });
  }

  if (comment.replies && comment.replies.length > 0) {
    await Comment.deleteMany({ _id: { $in: comment.replies } });
  }

  await comment.deleteOne();

  try {
    await pusher.trigger("comments", "comment:deleted", { commentId: id });
  } catch (err) {
    console.error("Pusher error:", err);
  }

  return true;
};

// Like comment
const likeComment = async ({ id, userId }) => {
  const comment = await Comment.findById(id);
  if (!comment) throw new Error("Comment not found");

  const alreadyLiked = comment.likes.some((x) => x.toString() === userId);
  if (alreadyLiked) {
    comment.likes = comment.likes.filter((x) => x.toString() !== userId);
  } else {
    comment.dislikes = comment.dislikes.filter((x) => x.toString() !== userId);
    comment.likes.push(userId);
  }

  await comment.save();
  await comment.populate("author", "name");

  const pusherData = {
    commentId: comment._id.toString(),
    likeCount: comment.likes.length,
    dislikeCount: comment.dislikes.length,
  };
  try {
    await pusher.trigger("comments", "comment:liked", pusherData);
  } catch (err) {
    console.error("Pusher error:", err);
  }

  return {
    comment,
    likeCount: comment.likes.length,
    dislikeCount: comment.dislikes.length,
  };
};

// Dislike comment
const dislikeComment = async ({ id, userId }) => {
  const comment = await Comment.findById(id);
  if (!comment) throw new Error("Comment not found");

  const alreadyDisliked = comment.dislikes.some((x) => x.toString() === userId);
  if (alreadyDisliked) {
    comment.dislikes = comment.dislikes.filter((x) => x.toString() !== userId);
  } else {
    comment.likes = comment.likes.filter((x) => x.toString() !== userId);
    comment.dislikes.push(userId);
  }

  await comment.save();
  await comment.populate("author", "name email");

  const pusherData = {
    commentId: comment._id.toString(),
    likeCount: comment.likes.length,
    dislikeCount: comment.dislikes.length,
  };
  try {
    await pusher.trigger("comments", "comment:disliked", pusherData);
  } catch (err) {
    console.error("Pusher error:", err);
  }

  return {
    comment,
    likeCount: comment.likes.length,
    dislikeCount: comment.dislikes.length,
  };
};

// Reply to comment
const replyToComment = async ({ parentCommentId, content, userId }) => {
  const parentComment = await Comment.findById(parentCommentId);
  if (!parentComment) throw new Error("Parent comment not found");

  const reply = await Comment.create({
    content,
    author: userId,
    parentComment: parentCommentId,
  });
  await Comment.findByIdAndUpdate(parentCommentId, {
    $push: { replies: reply._id },
  });
  await reply.populate("author", "name email");

  try {
    await pusher.trigger("comments", "comment:reply", {
      reply: reply.toObject(),
      parentCommentId,
    });
  } catch (err) {
    console.error("Pusher error:", err);
  }

  return reply;
};

module.exports = {
  getComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
  dislikeComment,
  replyToComment,
};
