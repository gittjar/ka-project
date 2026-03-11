import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUsername: { type: String, required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  replies: [replySchema],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Message', messageSchema);
