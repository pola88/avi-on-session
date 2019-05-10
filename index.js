import url from 'url';
import _ from 'lodash';
import moment from 'moment';

function camelize(str) {
  return str[0].toLowerCase() + str.replace(/(_|-)([a-z])/g, (string) => {
      return string[1].toUpperCase();
  }).slice(1);
}

function getDomainAndEnv() {
  let urlParts = window.location.hostname.split('.');
  let domain = "localhost"; //TODO: dev
  let environment = "localhost";

  if(urlParts.length > 1) {
    domain = urlParts[1];
    let subDomain = urlParts[0].split('-');
    if(subDomain.length > 1) {
      environment = subDomain[1];
    } else {
      environment = _.includes(['qa', 'dev', 'next', 'stg', 'rab'], subDomain[0]) ? subDomain[0] : 'prd';
    }

  }

  return { domain, environment };
}


export default class Session {

  static setCredentials(credentials) {
    let parsedCredentials = {};
    _.each(credentials, (value, key) => {
      parsedCredentials[camelize(key)] = value;
    });

    // let currentCredentials = Session._getFromCookie('credentials') || {};
    let { domain, environment } = getDomainAndEnv();
    //
    // currentCredentials[environment] = parsedCredentials;

    document.cookie = `credentials=${JSON.stringify(parsedCredentials)}; domain=${domain}`;
    Session.redirectTo(parsedCredentials);
  }

  static _getFromCookie(option) {
    let cookies = document.cookie;
    //TODO: I copied it from another project.
    let key = `(?:^|; )${option}(?:=([^;]*?))?(?:;|$)`;
    let reKey = new RegExp(key);

    return reKey.exec(cookies);
  }

  static getCredentials() {
    let credentials = Session._getFromCookie('credentials');
    if(credentials) {
      credentials = JSON.parse(decodeURIComponent(credentials[1]));
      // let { environment } = getDomainAndEnv();
      //
      // return credentials[environment];
    }

    return credentials;
  }

  static isLogged() {
    let credentials = credentials = Session.getCredentials();
    if(!credentials) {
      let loginPage = __SESSION_HOST__;
      var previousUrl = window.location.origin;
      if(url.parse(loginPage).host !== window.location.host) {
        if(window.location.pathname !== "/login" && window.location.pathname !== "/logout") {
          previousUrl += window.location.pathname;
          loginPage = `${loginPage}?previous_url=${previousUrl}`;
        }

        window.location.href = loginPage;
        return;
      }

      return false;
    } else {
      return Session.hasPermission(credentials);
    }
  }

  static hasPermission(credentials) {
    let pages = Session.getPages(credentials);
    //Current Page
    let urlParts = url.parse(window.location.href, true);
    let host = urlParts.host;
    //if the user has not permission for this page, it will be redirected to another page
    if(!_.includes(pages, host)) {
      window.location.href = pages[0];
      return false;
    } else {
      return true;
    }
  }

  static removeCredentials() {
    document.cookie = `credentials=;expires=${new Date().toUTCString()}`;
    Session.isLogged();
  }

  static parseCredentials(res) {
    let session = res.credentials;
    Session.setCredentials(res.credentials);

    return { session };
  }

  static redirectTo(credentials) {
    let pages = Session.getPages(credentials);
    //Current Page
    let urlParts = url.parse(window.location.href, true);
    let query = urlParts.query;

    if(query.previous_url) {
      let previousUrlParts = url.parse(query.previous_url, true);
      let previousHost = previousUrlParts.host;
      if(_.includes(pages, previousHost)) {
        return window.location.href = query.previous_url;
      }
    }

    let host = urlParts.host;
    //if the user has not permission for this page, it will be redirected to another page
    if(!_.includes(pages, host)) {
      window.location.href = pages[0];
    }
  }

  static getPages(credentials) {
    if(credentials.pages) {
      return credentials.pages;
    }

    let _domains = [];
    let myAccountHost = url.parse(__MY_ACCOUNT_URL__).host;
    let adminHost = url.parse(__ADMIN_HOST__).host;
    let csrHost = url.parse(__CSR_HOST__).host;

    if(_.includes(credentials.roleList, 'admin')) {
      _domains = [ adminHost, csrHost, myAccountHost ];
    } else if(_.includes(credentials.roleList, 'vendor')) {
      _domains = [ csrHost, myAccountHost ];
    }else if(_.includes(credentials.roleList, 'user')) {
      _domains = [ myAccountHost ];
    }

    credentials.pages = _domains;
    document.cookie = `credentials=${JSON.stringify(credentials)}`;
    return _domains;
  }

  static expired() {
    let credentials = Session._getFromCookie('credentials');

    if(credentials && moment().isAfter(credentials.expirationDate)) {
      return true;
    }else {
      return false;
    }
  }
}
