import mongoose, { Document, Model, Schema, model } from 'mongoose';

// Interface for a group member
export interface IGroupMember {
  user: mongoose.Schema.Types.ObjectId;
  role: 'admin' | 'companion';
  joinedAt: Date;
}

// Interface for a group invitation
export interface IGroupInvite {
  user: mongoose.Schema.Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  invitedAt: Date;
}

/* Main Group Interface */

export interface IGroup extends Document {
  name: string;
  trip: mongoose.Schema.Types.ObjectId;
  maxMembers: number;
  privacy: 'public' | 'private';
  difficulty?: string;
  description?: string;
  status: 'planned' | 'active' | 'completed';
  createdBy: mongoose.Schema.Types.ObjectId;
  members: IGroupMember[];
  invites: IGroupInvite[];
  scheduledStart?: Date;
  scheduledEnd?: Date;
  meetingPoint?: string;
  embarkedAt?: Date;
  chatRoomId?: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type IGroupModel = Model<IGroup>;

/* Embedded Schemas */

// Schema for a group member
const GroupMemberSchema = new Schema<IGroupMember>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'companion'], default: 'companion' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// Schema for a group invitation
const GroupInviteSchema = new Schema<IGroupInvite>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    invitedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/* Main Group Schema */

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true },
    trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
    maxMembers: { type: Number, required: true },
    privacy: { type: String, enum: ['public', 'private'], default: 'public' },
    difficulty: { type: String },
    description: { type: String },
    status: { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [GroupMemberSchema],
    invites: [GroupInviteSchema],
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    meetingPoint: { type: String },
    embarkedAt: { type: Date },
    chatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
  },
  { timestamps: true },
);

export const Group: IGroupModel = model<IGroup, IGroupModel>('Group', groupSchema);
