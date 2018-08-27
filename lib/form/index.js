module.exports = {
  login: require('./login'),
  register: require('./register'),
  invited: require('./invited'),
  revision: require('./revision'),
  comment: require('./comment'),
  me: {
    user: require('./me/user'),
    password: require('./me/password'),
    apiToken: require('./me/apiToken'),
  },
  admin: {
    app: require('./admin/app'),
    sec: require('./admin/sec'),
    auth: require('./admin/auth'),
    mail: require('./admin/mail'),
    aws: require('./admin/aws'),
    google: require('./admin/google'),
    github: require('./admin/github'),
    userInvite: require('./admin/userInvite'),
    slackSetting: require('./admin/slackSetting'),
    share: require('./admin/share'),
  },
}
