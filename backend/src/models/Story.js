import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId },
  username:  { type: String, required: true },
  content:   { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

const mediaSchema = new mongoose.Schema({
  url:       { type: String, required: true },
  blobName:  { type: String, required: true },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
});

const storySchema = new mongoose.Schema({
  title:    { type: String, required: true, trim: true, maxlength: 300 },
  content:  { type: String, required: true, maxlength: 500000 },
  author:   { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  media:    { type: [mediaSchema], default: [] },
  likes:    [{ userId: mongoose.Schema.Types.ObjectId, username: String }],
  comments: [commentSchema],
}, { timestamps: true });

export default mongoose.model('Story', storySchema);
