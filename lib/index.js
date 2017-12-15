// es6 runtime requirements
import 'babel-polyfill'

// their code
import express from 'express'
import sockets from 'socket.io'
import { json } from 'body-parser'
import { Server as http } from 'http'
import remail from 'email-regex'
import dom from 'vd'
import cors from 'cors'
import request from 'superagent';

// our code
import Slack from './slack'
import invite from './slack-invite'
import badge from './badge'
import splash from './splash'
import iframe from './iframe'
import log from './log'
import initPassport from './passport-facebook'
const passport = require('passport');
initPassport(passport);
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var flash = require('express-flash');
var handlebars = require('express-handlebars');
var sessionStore = new session.MemoryStore;

export default function slackin ({
  token,
  interval = 5000, // jshint ignore:line
  org,
  css,
  coc,
  cors: useCors = false,
  path='/',
  channels,
  emails,
  silent = false // jshint ignore:line,
}){
  // must haves
  if (!token) throw new Error('Must provide a `token`.')
  if (!org) throw new Error('Must provide an `org`.')

  if (channels) {
    // convert to an array
    channels = channels.split(',').map((channel) => {
      // sanitize channel name
      if ('#' === channel[0]) return channel.substr(1)
      return channel
    })
  }

  if (emails) {
    // convert to an array
    emails = emails.split(',')
  }

  // setup app
  let app = express()
  let srv = http(app)
  srv.app = app

  let assets = __dirname + '/assets'

  // fetch data
  let slack = new Slack({ token, interval, org })

  slack.setMaxListeners(Infinity)

  // capture stats
  log(slack, silent)

  // middleware for waiting for slack
  app.use((req, res, next) => {
    if (slack.ready) return next()
    slack.once('ready', next)
  })

  if (useCors) {
    app.options('*', cors())
    app.use(cors())
  }
app.use(cookieParser('secret'));
app.use(session({
    cookie: { maxAge: 60000 },
    store: sessionStore,
    saveUninitialized: true,
    resave: 'true',
    secret: 'secret'
}));
app.use(flash());

  // splash page
  app.get('/', (req, res) => {
    let { name, logo } = slack.org
    let { active, total } = slack.users
    let expressFlash = req.flash('success')
    if (!name) return res.send(404)
    let page = dom('html',
      dom('head',
        dom('title',
          'Join ', name, ' on Slack!'
        ),
        dom('meta name=viewport content="width=device-width,initial-scale=1.0,minimum-scale=1.0,user-scalable=no"'),
        dom('link rel="shortcut icon" href=https://slack.global.ssl.fastly.net/272a/img/icons/favicon-32.png'),
        css && dom('link rel=stylesheet', { href: css })
      ),
      splash({ coc, path, css, name, org, logo, channels, active, total, expressFlash })
    )
    res.type('html')
    res.send(page.toHTML())
  })

  app.get('/data', (req, res) => {
    let { name, logo } = slack.org
    let { active, total } = slack.users
    res.send({
      name,
      org,
      coc,
      logo,
      channels,
      active,
      total
    })
  })

  // static files
  app.use('/assets', express.static(assets))

app.post('/invite', passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: '/'}),
    function(req, res) {
        console.log('success login');
     var msg = ""
    let chanId
    if (channels) {
      let channel = req.body.channel
      if (!channels.includes(channel)) {
        return res
        .status(400)
        .json({ msg: 'Not a permitted channel' })
      }
      chanId = slack.getChannelId(channel)
      if (!chanId) {
        return res
        .status(400)
        .json({ msg: `Channel not found "${channel}"` })
      }
    }

    let email = req.user.emails[0].value;

    if (!email) {
	msg = encodeURIComponent('メールアドレスが見つかりませんでした。');
	req.flash('success', 'メールアドレスが見つかりませんでした。');
	return res.redirect('/?msg=' + msg)
    }

    if (!remail().test(email)) {
	msg = encodeURIComponent('メールアドレスが正しくありません。');
	req.flash('success', 'メールアドレスが正しくありません。');
	return res.redirect('/?msg=' + msg)
    }

    // Restricting email invites?
    if (emails && emails.indexOf(email) === -1) {
	msg = encodeURIComponent('このメールアドレスは許可されていないメールアドレスです。');
	req.flash('success', 'このメールアドレスは許可されていないメールアドレスです。');
	return res.redirect('/?msg=' + msg)
    }

    if (coc && '1' != req.body.coc) {
	msg = encodeURIComponent('規約に同意されていません。');
	req.flash('success', '規約に同意されていません。');
	return res.redirect('/?msg=' + msg)
    }

    invite({ token, org, email, channel: chanId }, err => {
      if (err) {
        if (err.message === `Sending you to Slack...`) {
	msg = encodeURIComponent('スラックに転送されます。');
	return res.redirect(`https://${org}.slack.com`); 
         // return res
         // .status(303)
         // .json({ msg: err.message, redirectUrl: `https://${org}.slack.com` })
        }

       // return res
       // .status(400)
       // .json({ msg: err.message })
      }

      //res
      //.status(200)
      //.json({ msg: 'メールアドレスを確認してご参加ください!' })
      msg = encodeURIComponent('招待メールをお送りしました。確認してご参加ください!');
      req.flash('success', '招待メールをお送りしました。確認してご参加ください!');
      res.redirect('/?msg=' + msg)
    })
}
);

  // invite endpoint
  app.post('/inviteold', json(), (req, res, next) => {
passport.authenticate('facebook', { successRedirect: '/',
                                      failureRedirect: '/' });
    let chanId
    if (channels) {
      let channel = req.body.channel
      if (!channels.includes(channel)) {
        return res
        .status(400)
        .json({ msg: 'Not a permitted channel' })
      }
      chanId = slack.getChannelId(channel)
      if (!chanId) {
        return res
        .status(400)
        .json({ msg: `Channel not found "${channel}"` })
      }
    }

    let email = req.body.email

    if (!email) {
      return res
      .status(400)
      .json({ msg: 'No email provided' })
    }

    if (!remail().test(email)) {
      return res
      .status(400)
      .json({ msg: 'Invalid email' })
    }

    // Restricting email invites?
    if (emails && emails.indexOf(email) === -1) {
      return res
      .status(400)
      .json({ msg: 'Your email is not on the accepted email list' })
    }

    if (coc && '1' != req.body.coc) {
      return res
      .status(400)
      .json({ msg: 'Agreement to CoC is mandatory' })
    }

    invite({ token, org, email, channel: chanId }, err => {
      if (err) {
        if (err.message === `Sending you to Slack...`) {
          return res
          .status(303)
          .json({ msg: err.message, redirectUrl: `https://${org}.slack.com` })
        }

        return res
        .status(400)
        .json({ msg: err.message })
      }

      res
      .status(200)
      .json({ msg: 'メールアドレスを確認してご参加ください!' })
    })
  })

  // iframe
  app.get('/iframe', (req, res) => {
    let large = 'large' in req.query
    let { active, total } = slack.users
    res.type('html')
    res.send(iframe({ path, active, total, large }).toHTML())
  })

  app.get('/iframe/dialog', (req, res) => {
    let large = 'large' in req.query
    let { name } = slack.org
    let { active, total } = slack.users
    if (!name) return res.send(404)
    let dom = splash({ coc, path, name, org, channels, active, total, large, iframe: true })
    res.type('html')
    res.send(dom.toHTML())
  })

  app.get('/.well-known/acme-challenge/:id', (req, res) => {
    res.send(process.env.LETSENCRYPT_CHALLENGE)
  })

  // badge js
  app.use('/slackin.js', express.static(assets + '/badge.js'))

  // badge rendering
  app.get('/badge.svg', (req, res) => {
    res.type('svg')
    res.set('Cache-Control', 'max-age=0, no-cache')
    res.set('Pragma', 'no-cache')
    res.send(badge(slack.users).toHTML())
  })

  // realtime
  sockets(srv).on('connection', socket => {
    socket.emit('data', slack.users)
    let change = (key, val) => socket.emit(key, val)
    slack.on('change', change)
    socket.on('disconnect', () => {
      slack.removeListener('change', change)
    })
  })

  return srv
}
