module.exports = function(crowi, app) {
  'use strict'

  var debug = require('debug')('crowi:routes:login')
  var async = require('async')
  var url = require('url')
  var config = crowi.getConfig()
  var mailer = crowi.getMailer()
  var User = crowi.model('User')
  var Config = crowi.model('Config')
  var actions = {}

  const clearSession = function(req) {
    req.session.google = {}
    req.session.github = {}
    req.session.social = {}
  }

  var loginSuccess = function(req, res, userData) {
    req.user = req.session.user = userData
    if (!userData.password) {
      return res.redirect('/me/password')
    }

    clearSession(req)

    var jumpTo = req.session.jumpTo
    if (jumpTo) {
      req.session.jumpTo = null
      return res.redirect(jumpTo)
    } else {
      return res.redirect('/')
    }
  }

  var loginFailure = function(req, res) {
    req.session.auth = {}
    req.flash('warningMessage', 'Sign in failure.')
    return res.redirect('/login')
  }

  actions.googleCallback = function(req, res) {
    debug('Header', req.url, req.headers.referer)
    const { query } = req
    const { code = '' } = query
    const { google = {} } = req.session
    const { callbackAction: nextAction = '/login' } = google
    debug('googleCallback.nextAction', nextAction)
    req.session.google = { authCode: code }
    debug('google auth code', code)

    return res.redirect(nextAction)
  }

  actions.githubCallback = function(req, res) {
    debug('Header', req.url, req.headers.referer)
    const { query } = req
    const { code = '' } = query
    const { github = {} } = req.session
    const { callbackAction: action } = github
    const nextAction = action ? url.format({ pathname: action, query }) : '/login'
    debug('githubCallback.nextAction', nextAction)
    req.session.github = { authCode: code }
    debug('github auth code', code)

    return res.redirect(nextAction)
  }

  actions.error = function(req, res) {
    var reason = req.params.reason
    var reasonMessage = ''

    if (reason === 'suspended') {
      reasonMessage = 'This account is suspended.'
    } else if (reason === 'registered') {
      reasonMessage = 'Wait for approved by administrators.'
    } else {
    }

    return res.render('login/error', {
      reason: reason,
      reasonMessage: reasonMessage,
    })
  }

  actions.login = function(req, res) {
    debug('Header', req.url, req.headers.referer)
    const { loginForm } = req.body

    if (req.method == 'POST' && req.form.isValid) {
      const { email, password } = loginForm

      if (config.crowi['auth:disablePasswordAuth']) {
        return loginFailure(req, res)
      }

      User.findUserByEmailAndPassword(email, password, function(err, userData) {
        debug('on login findUserByEmailAndPassword', err, userData)
        if (userData) {
          loginSuccess(req, res, userData)
        } else {
          loginFailure(req, res)
        }
      })
    } else {
      // method GET
      if (req.form) {
        debug(req.form.errors)
      }
      return res.render('login', {})
    }
  }

  actions.loginGoogle = function(req, res) {
    debug('Header', req.url, req.headers.referer)
    const googleAuth = require('../util/googleAuth')(config)
    const { google = {} } = req.session
    const { authCode: code } = google

    debug('code', code)
    if (!code) {
      googleAuth.createAuthUrl(req, function(err, redirectUrl) {
        if (err) {
          // TODO
        }

        req.session.google = { callbackAction: '/login/google' }
        return res.redirect(redirectUrl)
      })
    } else {
      googleAuth.handleCallback(req, function(err, tokenInfo) {
        debug('handleCallback', err, tokenInfo)
        if (err) {
          return loginFailure(req, res)
        }

        const { user_id: googleId } = tokenInfo
        User.findUserByGoogleId(googleId, function(err, userData) {
          debug('findUserByGoogleId', err, userData)
          if (!userData) {
            clearSession(req)
            const { user_id: id, email, name, picture: image } = tokenInfo
            req.session.google = { id, email, name, image }
            return res.redirect('/register')
          }
          return loginSuccess(req, res, userData)
        })
      })
    }
  }

  actions.loginGitHub = function(req, res, next) {
    debug('Header', req.url, req.headers.referer)
    const githubAuth = require('../util/githubAuth')(config)
    const { github = {} } = req.session
    const { authCode: code } = github

    debug('code', code)
    if (!code) {
      req.session.github = { callbackAction: '/login/github' }
      githubAuth.authenticate(req, res, next)
    } else {
      githubAuth.handleCallback(req, res, next)(function(err, tokenInfo) {
        debug('handleCallback', err, tokenInfo)
        if (err) {
          return loginFailure(req, res)
        }

        const { organizations, user_id: githubId } = tokenInfo
        if (organizations && !User.isGitHubAccountValid(organizations)) {
          clearSession(req)
          return loginFailure(req, res)
        }
        User.findUserByGitHubId(githubId, function(err, userData) {
          debug('findUserByGitHubId', err, userData)
          if (!userData) {
            clearSession(req)
            const { organizations, user_id: id, email, name, picture: image } = tokenInfo
            req.session.github = { organizations, id, email, name, image }
            return res.redirect('/register')
          }
          return loginSuccess(req, res, userData)
        })
      })
    }
  }

  actions.register = function(req, res, next) {
    debug('Header', req.url, req.headers.referer)
    const { lang = User.LANG_EN_US } = req

    // ログイン済みならさようなら
    if (req.user) {
      return res.redirect('/')
    }

    // config で closed ならさよなら
    if (config.crowi['security:registrationMode'] == Config.SECURITY_REGISTRATION_MODE_CLOSED) {
      return res.redirect('/')
    }

    if (req.method == 'POST' && req.form.isValid) {
      const { t } = req
      const { registerForm = {} } = req.form
      const { name = null, username = null, email = null, password = null, googleId = null, githubId = null, socialImage = null } = registerForm

      debug('registerForm', registerForm)

      // email と username の unique チェックする
      User.isRegisterable(email, username, function(isRegisterable, errOn) {
        let isError = false
        if (!User.isEmailValid(email)) {
          isError = true
          req.flash('registerWarningMessage', 'This email address could not be used. (Make sure the allowed email address)')
        }
        if (!isRegisterable) {
          isError = true
          if (!errOn.username) {
            req.flash('registerWarningMessage', t('page_register.error.unavailable_user_id'))
          }
          if (!errOn.email) {
            req.flash('registerWarningMessage', t('page_register.error.already_registered_email'))
          }
        }
        if (config.crowi['auth:disablePasswordAuth'] && (!googleId && !githubId)) {
          isError = true
          req.flash('registerWarningMessage', t('page_register.error.unavailable_password_auth'))
        }
        if (isError) {
          debug('isError user register error', errOn)
          return res.redirect('/register')
        }

        User.createUserByEmailAndPassword(name, username, email, password, lang, function(err, userData) {
          if (err) {
            req.flash('registerWarningMessage', 'Failed to register.')
            return res.redirect('/register')
          } else {
            // 作成後、承認が必要なモードなら、管理者に通知する
            if (config.crowi['security:registrationMode'] === Config.SECURITY_REGISTRATION_MODE_RESTRICTED) {
              // TODO send mail
              User.findAdmins(function(err, admins) {
                async.each(
                  admins,
                  function(adminUser, next) {
                    mailer.send(
                      {
                        to: adminUser.email,
                        subject: '[' + config.crowi['app:title'] + ':admin] A New User Created and Waiting for Activation',
                        template: 'admin/userWaitingActivation.txt',
                        vars: {
                          createdUser: userData,
                          adminUser: adminUser,
                          url: config.crowi['app:url'],
                          appTitle: config.crowi['app:title'],
                        },
                      },
                      function(err, s) {
                        debug('completed to send email: ', err, s)
                        next()
                      },
                    )
                  },
                  function(err) {
                    debug('Sending invitation email completed.', err)
                  },
                )
              })
            }

            if (googleId || githubId) {
              if (googleId) {
                userData.updateGoogleId(googleId, function(err, userData) {
                  if (err) {
                    // TODO
                  }
                  return loginSuccess(req, res, userData)
                })
              }
              if (githubId) {
                userData.updateGitHubId(githubId, function(err, userData) {
                  if (err) {
                    // TODO
                  }
                  return loginSuccess(req, res, userData)
                })
              }

              if (socialImage) {
                const axios = require('axios')
                const fileUploader = require('../util/fileUploader')(crowi, app)

                axios
                  .get(socialImage, { responseType: 'stream' })
                  .then(function(response) {
                    const type = response.headers['content-type']
                    const ext = type.replace('image/', '')
                    const filePath = User.createUserPictureFilePath(userData, ext)
                    const { data: fileStream } = response
                    fileStream.length = parseInt(response.headers['content-length'])

                    fileUploader
                      .uploadFile(filePath, type, fileStream, {})
                      .then(function(data) {
                        const imageUrl = fileUploader.generateUrl(filePath)
                        debug('user picture uploaded', imageUrl)
                        userData.updateImage(imageUrl, function(err, data) {
                          if (err) {
                            debug('Error on update user image', err)
                          }
                          // DONE
                        })
                      })
                      .catch(function(err) {
                        // ignore
                        debug('Upload error', err)
                      })
                  })
                  .catch(function() {
                    // ignore
                  })
              }
            } else {
              return loginSuccess(req, res, userData)
            }
          }
        })
      })
    } else {
      // method GET of form is not valid
      debug('session is', req.session)
      const isRegistering = true

      const { google = {}, github = {} } = req.session
      const { id: googleId } = google
      const { id: githubId } = github
      const socialId = googleId || githubId
      const socialEmail = google.email || github.email
      const socialName = google.name || github.name
      const socialImage = google.image || github.image
      const issuerName = googleId ? 'Google' : githubId ? 'GitHub' : ''

      if (!User.isEmailValid(socialEmail)) {
        req.flash('registerWarningMessage', 'This email address could not be used. (Make sure the allowed email address)')
        return res.redirect('/login?register=1')
      }
      if (github.organizations && !User.isGitHubAccountValid(github.organizations)) {
        req.flash('registerWarningMessage', 'This account could not be used. (Make sure whether you belong to allowed GitHub Organization)')
        return res.redirect('/login?register=1')
      }

      const locals = {
        isRegistering,
        googleId,
        githubId,
        socialId,
        socialEmail,
        socialName,
        socialImage,
        issuerName,
      }

      return res.render('login', locals)
    }
  }

  actions.invited = function(req, res) {
    if (!req.user) {
      return res.redirect('/login')
    }

    if (req.method == 'POST' && req.form.isValid) {
      var user = req.user
      var invitedForm = req.form.invitedForm || {}
      var username = invitedForm.username
      var name = invitedForm.name
      var password = invitedForm.password

      User.isRegisterableUsername(username, function(creatable) {
        if (creatable) {
          user.activateInvitedUser(username, name, password, function(err, data) {
            if (err) {
              req.flash('warningMessage', 'アクティベートに失敗しました。')
              return res.render('invited')
            } else {
              return res.redirect('/')
            }
          })
        } else {
          req.flash('warningMessage', '利用できないユーザーIDです。')
          debug('username', username)
          return res.render('invited')
        }
      })
    } else {
      return res.render('invited', {})
    }
  }

  actions.updateInvitedUser = function(req, res) {
    return res.redirect('/')
  }

  return actions
}
