// This is a default simple connector made to show you some common libs which can be used
// This connector fetches some cat images from the qwant api (which is more open than the google one)

'use strict'

const cheerio = require('cheerio')
const crypto = require('crypto')
const moment = require('moment')
const request = require('request')
const {baseKonnector, filterExisting, saveDataAndFile, models, log, linkBankOperation} = require('cozy-konnector-libs')
const Bill = models.bill;

module.exports = baseKonnector.createNew({
  name: 'Semidao',
  slug: 'semidao',
  description: 'Konnector Semidao',
  vendorLink: 'http://semidao.fr/',
  fields: {
    email: { type: 'text' },
    password: { type: 'password' },
  },
  models: [Bill],
  // fetchOperation is the list of function which will be called in sequence with the following
  // parameters :
  // requiredFields : the list of attributes of your connector that the user can choose (often login and password)
  // entries : it is an object which is passed accross the functions
  // data : another object passed accross function, not used
  // next : this is a callback you have to call when the task of the current function is finished
  fetchOperations: [
    openSession,  // needed to get a session cookie
    logIn,
    parseBillPage,
    customFilterExisting,
    customSaveDataAndFile,
    customLinkBankOperation 
  ]
})


const baseUrl  = 'http://agence-en-ligne.semidao.fr/wp/'
const homeUrl  = baseUrl + 'home.action'
const loginUrl = baseUrl + 'j_security_check'
const billsUrl = baseUrl + 'displayBills.action'

function openSession(requiredFields, billInfos, data, next) {
  //request.defaults({jar: true})
  const options = {
    method: 'GET',
    jar: true,
    url: homeUrl
  }
  request(options, function (err, res, body) {
    log('debug', 'openSession headers :'+decodeURIComponent(JSON.stringify(res.headers,null,'  ')))
    next()
  })
} 

function logIn (requiredFields, billInfos, data, next) {
  const logInOptions = {
    method: 'POST',
    form: {
      j_username: requiredFields.email,
      password: '',
      j_password: crypto.createHash('md5').update(requiredFields.password).digest("hex")
    },
    jar: true,
    url: loginUrl
  }

  request(logInOptions, function (err, res, body) {
    // should redirect to http://agence-en-ligne.semidao.fr/wp/home.action
    log('debug', logInOptions.form)
    log('debug', 'logIn POST result')
    log('debug', res.headers)

    const isNoLocation = !res.headers.location
    const isNot302 = res.statusCode !== 302
    const isError =
      res.headers.location &&
      res.headers.location.indexOf('error') !== -1

    if (err || isNoLocation || isNot302 || isError) {
      log('error', 'Authentification error')
      next('LOGIN_FAILED')
    } else {
      log('debug', 'getting home again…')

      const homeUrlOptions = {
	method: 'GET',
	jar: true,
	url: homeUrl
      }
      request(homeUrlOptions, function (err, res, body) {
	if(err) {
	  log('error', 'Authentification error 2')
	} else {

	  log('debug', 'now getting '+billsUrl)
	  const billsUrlOptions = {
	    method: 'GET',
	    jar: true,
	    url: billsUrl
	  }
	  request(billsUrlOptions, function (err, res, body) {
	    log('debug', 'after GET '+billsUrl)
	    //log('debug', res.headers)
	    if (err) {
	      log('error', err)
	      next('LOGIN_FAILED')
	    } else {
	      data.html = body
	      log('debug', 'billsUrl -> next')
	      next()
	    }
	  })
	}
      })
    }
  })
}


function parseBillPage (requiredFields, bills, data, next) {
  log('debug', 'in parseBillPage')

  bills.fetched = []

  if (!data.html) {
    log('info', 'No new bills to import')
    return next()
  }
  const $ = cheerio.load(data.html)

  //var fs = require('fs');
  //const $ = cheerio.load(fs.readFileSync('/home/sylvie/Téléchargements/displayBills.action.html'));
  //log('debug', $.html())

  var billTable = $('table#billTable > tbody')

  billTable.find('tr').each(function () {
    log('debug', 'row : '+$(this).text())
    var children = $(this).children();
    let billDate   = $(children[0]).text()
    let billRef    = $(children[1]).text()
    let billAmount = $(children[2]).text()
    let billUrl    = $(this).find('a').attr('href')
    billAmount = parseFloat(billAmount)
    //log('debug', 'billDate='+billDate+' billRef='+billRef+' billAmount='+billAmount+' billUrl='+billUrl)

    let bill = {
      amount: billAmount,
      date: moment(billDate, 'DD/MM/YYYY'),
      vendor: 'Semidao',
      pdfurl: baseUrl+billUrl
    }
    log('debug', 'bill:'+ JSON.stringify(bill)); log('debug', bill)
    if (billUrl) {
      bills.fetched.push(bill)
    } else {
      log('warning', 'Bill ref. "'+billRef+'" not fetched because of void URL')
    }
  })
  next()
}


function customFilterExisting (requiredFields, entries, data, next) {
  filterExisting(null, Bill)(requiredFields, entries, data, next)
}

function customSaveDataAndFile (requiredFields, entries, data, next) {
  saveDataAndFile(null, Bill, 'Semidao', ['facture'])(
    requiredFields, entries, data, next)
}

function customLinkBankOperation (requiredFields, entries, data, next) {
  linkBankOperation({
    model: Bill,
    identifier: 'Semidao',
    minDateDelta: 4,
    maxDateDelta: 25,
    amountDelta: 0.1
  }) (requiredFields, entries, data, next);
}

