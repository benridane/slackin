'use strict';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const FacebookStrategy = require('passport-facebook').Strategy;

let initPassport = function(passport) {
passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: "https://valujoin.me:9090/auth/facebook/callback",
    profileFields: ['id', 'displayName','email']
  },
    function(accessToken, refreshToken, profile, done) {
        // ２）Facebook認証のVerifyイベント
                 console.log('Passport.verify');
                         return done(null, profile);
                             }
));
};

module.exports = initPassport;
