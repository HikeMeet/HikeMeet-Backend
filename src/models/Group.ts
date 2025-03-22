import mongoose, { Document, Model, Schema, model } from 'mongoose';

/* Embedded Interfaces */

// Interface for a group member
export interface IGroupMember {
  user: mongoose.Schema.Types.ObjectId;
  role: 'admin' | 'companion';
  joined_at: Date;
}

// Interface for a pending membership action (invitation or join request)
export interface IGroupPending {
  user: mongoose.Schema.Types.ObjectId;
  origin: 'invite' | 'request';
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date;
}

/* Main Group Interface */

export interface IGroup extends Document {
  name: string;
  trip: mongoose.Schema.Types.ObjectId;
  max_members: number;
  privacy: 'public' | 'private';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'hardcore';
  description?: string;
  status: 'planned' | 'active' | 'completed';
  created_by: mongoose.Schema.Types.ObjectId;
  members: IGroupMember[];
  pending: IGroupPending[];
  scheduled_start?: Date;
  scheduled_end?: Date;
  meeting_point?: string;
  embarked_at?: string;
  chat_room_id?: mongoose.Schema.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

type IGroupModel = Model<IGroup>;

/* Embedded Schemas */

// Schema for a group member
const GroupMemberSchema = new Schema<IGroupMember>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'companion'], default: 'companion' },
    joined_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Schema for a pending membership action
const GroupPendingSchema = new Schema<IGroupPending>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    origin: { type: String, enum: ['invite', 'request'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/* Main Group Schema */

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    max_members: { type: Number, required: true },
    privacy: { type: String, enum: ['public', 'private'], default: 'public' },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'hardcore'],
    },
    description: { type: String },
    status: { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [GroupMemberSchema],
    pending: [GroupPendingSchema],
    scheduled_start: { type: Date },
    scheduled_end: { type: Date },
    meeting_point: { type: String },
    embarked_at: { type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ }, // Optional regex to ensure HH:mm
    chat_room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Group: IGroupModel = model<IGroup, IGroupModel>('Group', groupSchema);
