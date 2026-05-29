/**
 * Passport.js Configuration
 * Google OAuth 2.0 strategy — issues JWT cookies after OAuth handshake.
 * Sessions are used only for the brief OAuth state check; app auth uses JWT.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../models/User';
import appConfig from './index';
import logger from '../utils/logger';

// Minimal serialize/deserialize — session stores only userId during OAuth handshake
passport.serializeUser((user: any, done) => {
  done(null, user._id.toString());
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

if (appConfig.google.enabled && appConfig.google.clientId && appConfig.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: appConfig.google.clientId,
        clientSecret: appConfig.google.clientSecret,
        callbackURL: appConfig.google.callbackUrl,
        scope: ['profile', 'email'],
      },
      async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Google'), undefined);
          }

          // 1. Already linked via googleId
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            // 2. Existing local account — link Google to it
            user = await User.findOne({ email });

            if (user) {
              user.googleId = profile.id;
              user.authProvider = 'google';
              if (!user.profilePicture && profile.photos?.[0]?.value) {
                user.profilePicture = profile.photos[0].value;
              }
              user.isVerified = true; // Google already verified email
              await user.save();
              logger.info(`Google OAuth: linked to existing account ${email}`);
            } else {
              // 3. Brand-new user via Google
              const firstName = profile.name?.givenName || 'User';
              const lastName = profile.name?.familyName || '';

              user = await User.create({
                googleId: profile.id,
                authProvider: 'google',
                email,
                firstName,
                lastName,
                profilePicture: profile.photos?.[0]?.value || null,
                isVerified: true, // Google already verified email
              });
              logger.info(`Google OAuth: new user created ${email}`);
            }
          }

          return done(null, user);
        } catch (err) {
          logger.error('Google OAuth strategy error:', err);
          return done(err as Error, undefined);
        }
      }
    )
  );

  logger.info('✅ Google OAuth strategy registered');
} else {
  logger.warn('⚠️  Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET missing)');
}

export default passport;
