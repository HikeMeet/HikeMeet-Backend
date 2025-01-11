"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const userSchema = new mongoose_1.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    first_name: { type: String },
    last_name: { type: String },
    gender: { type: String },
    birth_date: { type: Date },
    profile_picture: { type: String },
    bio: { type: String },
    facebook_link: { type: String },
    instagram_link: { type: String },
    role: { type: String, required: true, enum: ['user', 'admin'], default: 'user' },
    social: {
        posts_saved: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Post' }],
        posts_liked: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Post' }],
        total_likes: { type: Number },
        total_shares: { type: Number },
        total_saves: { type: Number },
    },
    friends: [
        {
            status: {
                type: String,
                enum: ['active', 'pending', 'blocked'],
                default: 'pending',
            },
            id: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User',
            },
        },
    ],
    firebase_id: { type: String },
    created_on: { type: Date, required: true, default: Date.now },
    updated_on: { type: Date, required: true, default: Date.now },
});
exports.User = (0, mongoose_1.model)('User', userSchema);
//# sourceMappingURL=User.js.map