const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/login', passport.authenticate('auth0', {
  scope: 'openid profile email'
}), (req, res) => {
  res.redirect('/');
});

router.get('/callback', (req, res, next) => {
  passport.authenticate('auth0', (err, user, info) => {
    if (err) {
      return res.redirect('/');
    }
    if (!user) {
      return res.redirect('/');
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return res.redirect('/');
      }
      return res.redirect('/');
    });
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect('/');
  });
});

router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        name: req.user.displayName,
        email: req.user.emails[0].value
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;