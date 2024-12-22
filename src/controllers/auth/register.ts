import { RequestHandler } from 'express';
import Joi from '@hapi/joi';
import { relogRequestHandler } from '../../middleware/request-middleware';
import { User } from '../../models/User';

// Validation schema for user registration
export const addUserSchema = Joi.object().keys({
  username: Joi.string().alphanum().min(3).max(30).required(), // Added username
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  gender: Joi.string().optional(),
  birthDate: Joi.date().optional(),
  profilePicture: Joi.string().uri().optional(),
  bio: Joi.string().optional(),
  facebookLink: Joi.string().uri().optional(),
  instagramLink: Joi.string().uri().optional(),
  role: Joi.string().valid('user', 'admin').optional(),
});

const registerWrapper: RequestHandler = async (req, res) => {
  const {
    username, // Added username
    email,
    password,
    firstName,
    lastName,
    gender,
    birthDate,
    profilePicture,
    bio,
    facebookLink,
    instagramLink,
    role,
  } = req.body;

  const user = new User({
    username, // Included username in the user object
    email,
    firstName,
    lastName,
    gender,
    birthDate,
    profilePicture,
    bio,
    facebookLink,
    instagramLink,
    role,
    createdOn: Date.now(),
    updatedOn: Date.now(),
  });

  // Hash and set the user's password
  user.password = user.encryptPassword(password);

  // Save the user to the database
  await user.save();

  // Return the created user (excluding sensitive fields like password)
  res.status(201).json(user.toJSON());
};

export const register = relogRequestHandler(registerWrapper, {
  validation: { body: addUserSchema },
  skipJwtAuth: true,
});
